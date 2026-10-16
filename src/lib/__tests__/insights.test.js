import { describe, expect, it } from 'vitest';
import { emptyDoc, put, putSetting } from '../doc';
import { withDefaults } from '../defaults';
import { buildModel } from '../model';
import { makeSnapshot, snapshotValue, decompose } from '../snapshots';
import { monthReport, forecast, bigPurchaseClashes, buildAlerts, cardFees } from '../insights';
import { occurrenceId } from '../ledger';

const rates = { USD: '1', TRY: '50', CZK: '20', EUR: '0.9', XAU: '0.00025' };
const TODAY = '2026-11-10';

function build() {
    let doc = withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 });
    doc = putSetting(doc, 'spendingCurrency', 'CZK', 1);
    const acct = (id, currency, kind, amount, extra = {}) => {
        doc = put(doc, 'accounts', { id, name: id, currency, kind, available: true, ...extra }, 1);
        doc = put(doc, 'anchors', { id: `a_${id}`, accountId: id, amount, date: '2026-11-01', setAt: 5 }, 5);
    };
    acct('wise', 'CZK', 'ewallet', 1000000);              // 10,000 CZK = 25,000 TRY
    acct('bank', 'TRY', 'bank', 2000000);                 // 20,000 TRY
    acct('fund', 'TRY', 'investment', 400000, { available: false });
    acct('card', 'TRY', 'credit', -100000, { linkedAccountId: 'bank', limit: 5000000, monthlyRate: '3.75' });
    doc = put(doc, 'goldEvents', { id: 'g1', type: 'adjust', date: '2026-11-01', mg: 2000, portionId: 'portion_available' }, 6);
    doc = put(doc, 'goldEvents', { id: 'g2', type: 'adjust', date: '2026-11-01', mg: 4000, portionId: 'portion_longterm' }, 6);
    doc = put(doc, 'rules', { id: 'salary', type: 'income', amount: 6000000, currency: 'TRY', dayOfMonth: 1, startMonth: '2026-11', accountId: 'bank', categoryId: 'cat_salary' }, 1);
    doc = put(doc, 'rules', { id: 'dorm', type: 'expense', amount: 630000, currency: 'CZK', dayOfMonth: 20, startMonth: '2026-11', accountId: 'wise', categoryId: 'cat_housing' }, 1);
    doc = put(doc, 'tx', { id: occurrenceId('salary', '2026-11'), ruleId: 'salary', ruleMonth: '2026-11', type: 'income', amount: 6000000, currency: 'TRY', date: '2026-11-01', accountId: 'bank', createdAt: 2 }, 2);
    doc = put(doc, 'tx', { id: 'groc', type: 'expense', amount: 100000, currency: 'CZK', date: '2026-11-05', accountId: 'wise', categoryId: 'cat_groceries', createdAt: 10 }, 10);
    doc = put(doc, 'tx', { id: 'fridge', type: 'expense', amount: 340000, currency: 'CZK', date: '2026-11-03', accountId: null, categoryId: 'cat_household', debt: { direction: 'iOwe', certainty: 'possible', status: 'open' }, createdAt: 10 }, 10);
    doc = put(doc, 'budgets', { id: 'b1', categoryId: 'cat_groceries', amount: 320000, currency: 'CZK' }, 1);
    return doc;
}

describe('model', () => {
    const model = buildModel(build(), rates, TODAY);
    it('computes available money with its stated definition', () => {
        // gram = (1/0.00025)/31.1034768*50 = 6430.15 TRY
        expect(model.gold.availableValue).toBe(1286030);
        // wise after groceries: 9,000 CZK = 22,500 TRY; bank 20,000; card debt 1,000; dorm due 6,300 CZK = 15,750 TRY
        expect(model.totals.availableCash).toBe(2250000 + 2000000);
        expect(model.totals.billsDue).toBe(1575000);
        expect(model.totals.availableNow).toBe(4250000 + 1286030 - 100000 - 1575000);
    });
    it('shows a possible debt without subtracting it', () => {
        expect(model.totals.iOwePossible).toBe(850000);
        expect(model.totals.iOweCertain).toBe(0);
    });
    it('counts the fund and long-term gold in net worth only', () => {
        expect(model.totals.netWorth).toBe(4250000 + 400000 + 1286030 + 2572060 - 100000);
    });
});

describe('snapshots', () => {
    it('round-trips net worth and splits change into saving and market', () => {
        const model = buildModel(build(), rates, TODAY);
        const s0 = makeSnapshot(model, '2026-11-10T10:00:00Z');
        expect(snapshotValue(s0, 'TRY').netWorth).toBe(model.totals.netWorth);
        // A month later: 1,000 CZK more in Wise, and the lira lost 10% against everything.
        const s1 = structuredClone(s0);
        s1.holdings.available.CZK += 100000;
        s1.prices.rates = { ...s1.prices.rates, TRY: '55' };
        const parts = decompose(s0, s1, 'TRY');
        expect(parts.saved).toBe(250000);
        expect(parts.saved + parts.market).toBe(parts.total);
        expect(parts.market).toBeGreaterThan(0);
    });
});

describe('month report', () => {
    const doc = build();
    const report = monthReport(doc, '2026-11', 'CZK', { rates }, TODAY);
    const groceries = report.rows.find((r) => r.categoryId === 'cat_groceries');
    it('tracks spending against budget with pace and projection', () => {
        expect(groceries.spent).toBe(100000);
        expect(groceries.budget).toBe(320000);
        expect(groceries.pace).toBe(106667);
        expect(groceries.projected).toBe(100000 + 200000);
        expect(groceries.status).toBe('ok');
    });
    it('includes the pending dorm bill in its projection', () => {
        expect(report.rows.find((r) => r.categoryId === 'cat_housing').projected).toBe(630000);
    });
    it('counts the fridge as spending this month', () => {
        expect(report.spending.byCategory.cat_household).toBe(340000);
        expect(report.income).toBe(2400000);
    });
});

describe('planning', () => {
    it('flags two big purchases in one month', () => {
        let doc = build();
        doc = put(doc, 'planned', { id: 'boots', name: 'Boots', month: '2026-11', big: true, status: 'planned', min: 150000, max: 250000, currency: 'CZK' }, 1);
        doc = put(doc, 'planned', { id: 'phones', name: 'Headphones', month: '2026-11', big: true, status: 'planned', max: 300000, currency: 'CZK' }, 1);
        expect(bigPurchaseClashes(doc).map((c) => c.month)).toEqual(['2026-11']);
        const rows = forecast(buildModel(doc, rates, TODAY), TODAY);
        expect(rows).toHaveLength(3);
        expect(rows[0].planned).toBe(Math.round((200000 + 300000) * 2.5));
        expect(rows[1].income).toBe(6000000);
        expect(rows[1].start).toBe(rows[0].end);
        const alerts = buildAlerts(buildModel(doc, rates, TODAY), TODAY).map((a) => a.kind);
        expect(alerts).toContain('bigClash');
        expect(alerts).toContain('card');
        expect(alerts).toContain('debt');
        expect(alerts).toContain('snapshot');
    });
    it('sums card fees', () => {
        let doc = build();
        doc = put(doc, 'tx', { id: 'int', type: 'expense', categoryId: 'cat_fees', amount: 94100, currency: 'TRY', date: '2026-10-20', accountId: 'card' }, 1);
        expect(cardFees(doc, '2026-01-01', '2026-12-31', 'TRY', { rates })).toBe(94100);
        expect(cardFees(doc, '2026-01-01', '2026-12-31', 'TRY', { rates }, { accountId: 'wise' })).toBe(0);
    });
});
