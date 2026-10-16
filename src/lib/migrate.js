import Big from 'big.js';
import { emptyDoc, put, putSetting } from './doc';
import { withDefaults } from './defaults';
import { isCurrencyCode, toMinor } from './money';
import { today as todayISO } from './dates';

// One-way upgrade from the pre-v5 data (cards / funds / others / investments / incomes /
// history, floats in major units) to the v5 document. Pure and deterministic: the same legacy
// input and the same `at` always give the same document, with ids derived from the legacy
// ids, so two devices that migrate on their own end up with records that merge cleanly.
//
// Nothing here deletes the legacy data. The caller keeps the legacy row columns untouched and
// stores a full copy alongside the new document.

const num = (value) => {
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : 0;
};
const minor = (value, currency) => toMinor(new Big(String(num(value))), currency);
const code = (value, fallback) => (isCurrencyCode(value) ? value : fallback);
const keyOf = (id) => String(id).replace(/[^\w-]/g, '');

const legacyKind = (name = '') => {
    const n = name.toLowerCase();
    if (/(wallet|cash|nakit)/.test(n)) return 'cash';
    if (/(wise|revolut|papara|paypal)/.test(n)) return 'ewallet';
    return 'bank';
};

/** Only snapshots that recorded the cash position can be placed honestly; the rest are dropped. */
export function legacySnapshotUsable(snapshot) {
    return Boolean(snapshot && snapshot.date && typeof snapshot.totalCash === 'number' && typeof snapshot.totalCardDebt === 'number');
}

export function migrateLegacy(legacy, { at, today = todayISO() } = {}) {
    const displayCurrency = code(legacy?.currency, 'TRY');
    const used = new Set([displayCurrency]);
    let doc = emptyDoc();
    const anchor = (accountId, amount) => {
        doc = put(doc, 'anchors', { id: `anchor_${accountId}_legacy`, accountId, amount, date: today, setAt: at }, at);
    };

    (Array.isArray(legacy?.cards) ? legacy.cards : []).forEach((card, order) => {
        if (!card) return;
        const currency = code(card.currency, displayCurrency);
        used.add(currency);
        const id = `acct_card_${keyOf(card.id)}`;
        const depositId = `acct_card_${keyOf(card.id)}_deposit`;
        const name = card.name || 'Card';
        doc = put(doc, 'accounts', { id: depositId, name: `${name} account`, kind: 'bank', currency, available: true, order: order * 2 + 1 }, at);
        anchor(depositId, minor(card.money, currency));
        doc = put(doc, 'accounts', {
            id, name, kind: 'credit', currency, available: true, order: order * 2,
            linkedAccountId: depositId,
            limit: minor(card.limit, currency),
            monthlyRate: num(card.interestRate) > 0 ? String(card.interestRate) : null,
        }, at);
        anchor(id, -minor(card.debt, currency));
    });

    (Array.isArray(legacy?.funds) ? legacy.funds : []).forEach((fund, order) => {
        if (!fund) return;
        const currency = code(fund.currency, displayCurrency);
        used.add(currency);
        const id = `acct_fund_${keyOf(fund.id)}`;
        doc = put(doc, 'accounts', { id, name: fund.name || 'Account', kind: legacyKind(fund.name), currency, available: true, order: 100 + order }, at);
        anchor(id, minor(fund.amount, currency));
    });

    const month = today.slice(0, 7);
    for (const bill of Array.isArray(legacy?.others) ? legacy.others : []) {
        if (!bill || num(bill.amount) === 0) continue;
        const currency = code(bill.currency, displayCurrency);
        used.add(currency);
        if (bill.isRecurring !== false) {
            doc = put(doc, 'rules', {
                id: `rule_bill_${keyOf(bill.id)}`, type: 'expense', name: bill.name || 'Bill',
                amount: minor(bill.amount, currency), currency, accountId: null, categoryId: 'cat_other',
                dayOfMonth: Math.min(31, Math.max(1, num(bill.recurrenceDay) || 1)), startMonth: month,
                endMonth: bill.endDate ? bill.endDate.slice(0, 7) : null, variable: false,
            }, at);
        } else {
            doc = put(doc, 'planned', {
                id: `planned_bill_${keyOf(bill.id)}`, name: bill.name || 'Payment', currency,
                min: minor(bill.amount, currency), max: minor(bill.amount, currency), month, priority: 1, big: false, status: 'planned',
            }, at);
        }
    }

    for (const income of Array.isArray(legacy?.incomes) ? legacy.incomes : []) {
        if (!income || !income.isRecurring || num(income.amount) === 0) continue;
        const currency = code(income.currency, displayCurrency);
        used.add(currency);
        doc = put(doc, 'rules', {
            id: `rule_income_${keyOf(income.id)}`, type: 'income', name: income.name || 'Income',
            amount: minor(income.amount, currency), currency, accountId: null, categoryId: 'cat_salary',
            dayOfMonth: Math.min(31, Math.max(1, num(income.recurrenceDay) || 1)), startMonth: month,
            endMonth: income.endDate ? income.endDate.slice(0, 7) : null, variable: false,
        }, at);
    }

    // The old screen described gold as "the part you don't touch" and kept it out of the
    // headline, so it moves into the long-term portion to keep that meaning.
    const investments = Array.isArray(legacy?.investments)
        ? legacy.investments
        : (num(legacy?.goldGrams ?? legacy?.gold_grams) > 0 ? [{ id: 'gold', type: 'gold', amount: legacy.goldGrams ?? legacy.gold_grams }] : []);
    for (const item of investments) {
        if (!item || num(item.amount) === 0) continue;
        if (item.type === 'gold') {
            doc = put(doc, 'goldEvents', {
                id: `gold_legacy_${keyOf(item.id)}`, type: 'adjust', date: today,
                mg: Number(new Big(String(num(item.amount))).times(1000).round(0).toString()),
                portionId: 'portion_longterm', note: 'Carried over from the previous version',
            }, at);
        } else {
            const currency = item.type === 'euro' ? 'EUR' : item.type === 'usd' ? 'USD' : displayCurrency;
            used.add(currency);
            const id = `acct_inv_${keyOf(item.id)}`;
            doc = put(doc, 'accounts', { id, name: item.name || 'Investment', kind: 'investment', currency, available: false, order: 200 }, at);
            anchor(id, minor(item.amount, currency));
        }
    }

    for (const snapshot of Array.isArray(legacy?.history) ? legacy.history : []) {
        if (!legacySnapshotUsable(snapshot)) continue;
        const currency = code(snapshot.currency, displayCurrency);
        doc = put(doc, 'snapshots', {
            id: `snap_${keyOf(snapshot.id || snapshot.date)}`,
            date: snapshot.date,
            legacy: true,
            holdings: {
                available: { [currency]: minor(snapshot.totalCash, currency) },
                locked: { [currency]: minor(snapshot.totalInvestmentValue, currency) },
                debt: { [currency]: minor(snapshot.totalCardDebt, currency) },
                goldAvailableMg: 0,
                goldLockedMg: 0,
            },
            prices: null,
        }, at);
    }

    doc = withDefaults(doc, { displayCurrency, at });
    doc = putSetting(doc, 'currencies', [...used], at);
    return doc;
}
