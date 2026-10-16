import { describe, expect, it } from 'vitest';
import { emptyDoc, merge, put, remove, list, replaceAll, sameDoc } from '../doc';
import { accountBalances, billsDueBeforePayday, isSpending, occurrenceId, occurrencesIn, nextIncomeDate } from '../ledger';
import { goldHoldings, goldTotals, goldCostBasis } from '../gold';
import { withDefaults } from '../defaults';

const fx = { rates: { USD: '1', TRY: '49.5', CZK: '21.5', EUR: '0.9' }, overrides: {} };

describe('merge', () => {
    it('keeps both sides\' new records and the newest edit of shared ones', () => {
        let base = put(emptyDoc(), 'accounts', { id: 'a', name: 'Wise', currency: 'CZK' }, 10);
        const phone = put(base, 'tx', { id: 't1', type: 'expense', amount: 100, currency: 'CZK', date: '2026-11-01' }, 20);
        const laptop = put(base, 'accounts', { id: 'a', name: 'Wise CZK', currency: 'CZK' }, 30);
        const merged = merge(phone, laptop);
        expect(merged.tx.t1.amount).toBe(100);
        expect(merged.accounts.a.name).toBe('Wise CZK');
        expect(sameDoc(merge(laptop, phone), merged)).toBe(true);
        expect(sameDoc(merge(merged, merged), merged)).toBe(true);
    });
    it('lets a deletion win over an older copy', () => {
        const base = put(emptyDoc(), 'tx', { id: 't', amount: 1 }, 10);
        const deleted = remove(base, 'tx', 't', 20);
        expect(list(merge(base, deleted), 'tx')).toHaveLength(0);
        const editedLater = put(base, 'tx', { id: 't', amount: 2 }, 30);
        expect(list(merge(deleted, editedLater), 'tx')).toHaveLength(1);
    });
    it('restore tombstones everything that was there', () => {
        const current = put(emptyDoc(), 'tx', { id: 'old', amount: 1 }, 10);
        const incoming = put(emptyDoc(), 'tx', { id: 'new', amount: 2 }, 5);
        const restored = replaceAll(current, incoming, 100);
        expect(list(merge(current, restored), 'tx').map((t) => t.id)).toEqual(['new']);
    });
});

describe('balances', () => {
    const build = () => {
        let doc = emptyDoc();
        doc = put(doc, 'accounts', { id: 'wise', currency: 'CZK', kind: 'ewallet' }, 1);
        doc = put(doc, 'accounts', { id: 'bank', currency: 'TRY', kind: 'bank' }, 1);
        doc = put(doc, 'accounts', { id: 'card', currency: 'TRY', kind: 'credit' }, 1);
        doc = put(doc, 'anchors', { id: 'a1', accountId: 'wise', amount: 500000, date: '2026-10-16', setAt: 100 }, 100);
        doc = put(doc, 'anchors', { id: 'a2', accountId: 'bank', amount: 4109372, date: '2026-10-16', setAt: 100 }, 100);
        doc = put(doc, 'anchors', { id: 'a3', accountId: 'card', amount: -998649, date: '2026-10-16', setAt: 100 }, 100);
        return doc;
    };
    it('ignores transactions the typed balance already includes', () => {
        let doc = build();
        doc = put(doc, 'tx', { id: 'before', type: 'expense', accountId: 'wise', amount: 1000, currency: 'CZK', date: '2026-10-15', createdAt: 50 }, 50);
        doc = put(doc, 'tx', { id: 'sameDayEarlier', type: 'expense', accountId: 'wise', amount: 1000, currency: 'CZK', date: '2026-10-16', createdAt: 60 }, 60);
        doc = put(doc, 'tx', { id: 'after', type: 'expense', accountId: 'wise', amount: 25000, currency: 'CZK', date: '2026-10-17', createdAt: 200 }, 200);
        expect(accountBalances(doc, fx).wise).toBe(475000);
    });
    it('pays a card with a transfer and converts cross-currency spending', () => {
        let doc = build();
        doc = put(doc, 'tx', { id: 'pay', type: 'transfer', accountId: 'bank', toAccountId: 'card', amount: 998649, currency: 'TRY', date: '2026-10-17' }, 200);
        doc = put(doc, 'tx', { id: 'topup', type: 'transfer', accountId: 'bank', toAccountId: 'wise', amount: 230000, currency: 'TRY', toAmount: 100000, date: '2026-10-17' }, 200);
        doc = put(doc, 'tx', { id: 'ai', type: 'expense', accountId: 'wise', amount: 120000, currency: 'TRY', date: '2026-10-18' }, 200);
        const b = accountBalances(doc, fx);
        expect(b.card).toBe(0);
        expect(b.bank).toBe(4109372 - 998649 - 230000);
        expect(b.wise).toBe(500000 + 100000 - 52121);
    });
    it('uses the frozen rate of the transaction date', () => {
        let doc = build();
        doc = put(doc, 'fxDays', { id: '2026-10-18', rates: { USD: '1', TRY: '40', CZK: '20' } }, 1);
        doc = put(doc, 'tx', { id: 'ai', type: 'expense', accountId: 'wise', amount: 120000, currency: 'TRY', date: '2026-10-18' }, 200);
        expect(accountBalances(doc, fx).wise).toBe(500000 - 60000);
    });
});

describe('rules and spending', () => {
    let doc = emptyDoc();
    doc = put(doc, 'rules', { id: 'salary', type: 'income', amount: 6000000, currency: 'TRY', dayOfMonth: 1, startMonth: '2026-10' }, 1);
    doc = put(doc, 'rules', { id: 'dorm', type: 'expense', amount: 625000, currency: 'CZK', dayOfMonth: 31, startMonth: '2026-10' }, 1);
    doc = put(doc, 'rules', { id: 'ai', type: 'expense', amount: 120000, currency: 'TRY', dayOfMonth: 20, startMonth: '2026-10' }, 1);
    it('places the 31st on the last day of short months', () => {
        expect(occurrencesIn(doc, '2026-11').find((o) => o.rule.id === 'dorm').date).toBe('2026-11-30');
    });
    it('finds the next payday and the bills before it', () => {
        expect(nextIncomeDate(doc, '2026-10-17')).toBe('2026-11-01');
        const done = put(doc, 'tx', { id: occurrenceId('ai', '2026-10'), type: 'expense', amount: 120000, currency: 'TRY', date: '2026-10-20', ruleId: 'ai' }, 2);
        const due = billsDueBeforePayday(done, '2026-10-16');
        expect(due.payday).toBe('2026-11-01');
        expect(due.items.map((o) => o.rule.id)).toEqual(['dorm']);
    });
    it('does not count transfers, settlements or money owed to me as spending', () => {
        expect(isSpending({ type: 'expense', amount: 1 })).toBe(true);
        expect(isSpending({ type: 'transfer', amount: 1 })).toBe(false);
        expect(isSpending({ type: 'expense', amount: 1, settlesTxId: 'x' })).toBe(false);
        expect(isSpending({ type: 'expense', amount: 1, debt: { direction: 'owedToMe' } })).toBe(false);
        expect(isSpending({ type: 'expense', amount: 1, skipped: true })).toBe(false);
    });
});

describe('gold', () => {
    let doc = withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 });
    doc = put(doc, 'goldEvents', { id: 'b1', type: 'buy', date: '2026-01-01', mg: 5000, portionId: 'portion_available', price: 2500000, currency: 'TRY' }, 2);
    doc = put(doc, 'goldEvents', { id: 'b2', type: 'buy', date: '2026-02-01', mg: 1800, portionId: 'portion_longterm', price: 1080000, currency: 'TRY' }, 3);
    doc = put(doc, 'goldEvents', { id: 'm', type: 'move', date: '2026-03-01', mg: 1000, portionId: 'portion_available', toPortionId: 'portion_longterm' }, 4);
    it('tracks grams per portion', () => {
        expect(goldHoldings(doc)).toEqual({ portion_available: 4000, portion_longterm: 2800 });
        expect(goldTotals(doc)).toMatchObject({ availableMg: 4000, lockedMg: 2800, totalMg: 6800 });
    });
    it('keeps an average cost through a sale', () => {
        const sold = put(doc, 'goldEvents', { id: 's', type: 'sell', date: '2026-04-01', mg: 3400, portionId: 'portion_available' }, 5);
        const basis = goldCostBasis(sold, 'TRY', fx);
        expect(basis.mg).toBe(3400);
        expect(basis.cost).toBe(1790000);
    });
});

describe('dates', () => {
    it('finds the next date on a day of the month', async () => {
        const { nextDayOfMonth } = await import('../dates');
        expect(nextDayOfMonth('2026-10-16', 20)).toBe('2026-10-20');
        expect(nextDayOfMonth('2026-10-16', 16)).toBe('2026-10-16');
        expect(nextDayOfMonth('2026-10-16', 5)).toBe('2026-11-05');
        expect(nextDayOfMonth('2026-01-31', 30)).toBe('2026-02-28');
    });
});
