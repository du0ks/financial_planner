import { describe, expect, it } from 'vitest';
import { emptyDoc, list, put } from '../doc';
import { withDefaults } from '../defaults';
import { buildDemoDoc } from '../demo';
import { buildModel } from '../model';
import { interestIfMinimum } from '../cards';
import { convertMinor } from '../fx';
import { buildAlerts, incomeBuys, monthlyCost } from '../insights';
import { occurrenceId } from '../ledger';
import { allCurrencyCodes, currencyChoices } from '../money';
import { hasDebtsTab } from '../../ui/nav';

const rates = { USD: '1', TRY: '50', CZK: '20', EUR: '0.9', UAH: '44', XAU: '0.00025' };
const fx = { rates, overrides: {} };
const TODAY = '2026-11-10';

function build(display = 'TRY') {
    let doc = withDefaults(emptyDoc(), { displayCurrency: display, at: 1 });
    const acct = (id, currency, kind, amount, extra = {}) => {
        doc = put(doc, 'accounts', { id, name: id, currency, kind, available: true, ...extra }, 1);
        doc = put(doc, 'anchors', { id: `a_${id}`, accountId: id, amount, date: '2026-11-01', setAt: 5 }, 5);
    };
    acct('bank', 'TRY', 'bank', 5000000);
    acct('ziraat', 'TRY', 'credit', -3307117, { monthlyRate: '3.75', taxRate: '30', minPaymentPct: '20', limit: 5000000 });
    acct('mono', 'UAH', 'credit', -2000000, { rulePreset: 'generic', monthlyRate: '3.1', taxRate: '0', minPaymentPct: '5', minPaymentFloor: 10000, interestBase: 'statement' });
    acct('unrated', 'TRY', 'credit', -100000);
    return doc;
}

describe('new accounts start empty', () => {
    it('has no goals, budgets, planned purchases or rules', () => {
        const doc = withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 });
        for (const name of ['goals', 'budgets', 'planned', 'rules', 'accounts', 'tx', 'snapshots']) expect(list(doc, name)).toEqual([]);
        expect(list(buildDemoDoc(new Date('2026-11-10T12:00:00')), 'goals')).toEqual([]);
    });
});

describe('debts in the model', () => {
    const model = buildModel(build(), rates, TODAY);
    const card = (id) => model.cards.find((c) => c.id === id);
    it('gives each card its own terms and next-month interest in its own currency', () => {
        expect(card('ziraat').terms.interestBase).toBe('remainder');
        expect(card('ziraat').interestMonthly).toBe(128978);
        expect(card('mono').terms).toMatchObject({ taxPct: '0', interestBase: 'statement', minFloor: 10000 });
        expect(card('mono').interestMonthly).toBe(interestIfMinimum(2000000, card('mono').terms));
        expect(card('mono').interestMonthly).toBe(62000);                 // the whole ₴20,000 × 3.1%
        expect(card('unrated').interestMonthly).toBeNull();
    });
    it('sums card interest in the display currency', () => {
        expect(model.totals.cardInterestMonthly).toBe(128978 + convertMinor(62000, 'UAH', 'TRY', fx));
    });
    it('puts all debt into one Insights line that links to Debts', () => {
        const alerts = buildAlerts(model, TODAY);
        const debts = alerts.filter((a) => a.kind === 'debts');
        expect(debts).toHaveLength(1);
        expect(debts[0]).toMatchObject({ interest: model.totals.cardInterestMonthly, open: 0, link: 'debts' });
        expect(alerts.some((a) => ['card', 'cardDates', 'debt'].includes(a.kind))).toBe(false);
    });
    it('shows the Debts tab only with a card or an open debt', () => {
        expect(hasDebtsTab(model)).toBe(true);
        expect(hasDebtsTab(buildModel(withDefaults(emptyDoc(), { displayCurrency: 'UAH', at: 1 }), rates, TODAY))).toBe(false);
        let doc = withDefaults(emptyDoc(), { displayCurrency: 'UAH', at: 1 });
        doc = put(doc, 'tx', { id: 'fridge', type: 'expense', amount: 340000, currency: 'CZK', date: '2026-11-03', accountId: null, debt: { direction: 'iOwe', certainty: 'possible', status: 'open' } }, 1);
        expect(hasDebtsTab(buildModel(doc, rates, TODAY))).toBe(true);
    });
});

describe('monthly cost for the runway', () => {
    let doc = withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 });
    doc = put(doc, 'rules', { id: 'dorm', type: 'expense', amount: 630000, currency: 'CZK', dayOfMonth: 20, startMonth: '2026-11', categoryId: 'cat_housing' }, 1);
    doc = put(doc, 'rules', { id: 'ai', type: 'expense', amount: 2000, currency: 'USD', dayOfMonth: 15, startMonth: '2026-11', categoryId: 'cat_subscriptions' }, 1);
    doc = put(doc, 'rules', { id: 'old', type: 'expense', amount: 99900, currency: 'TRY', dayOfMonth: 1, startMonth: '2026-01', endMonth: '2026-06', categoryId: 'cat_other' }, 1);
    doc = put(doc, 'budgets', { id: 'b1', categoryId: 'cat_groceries', amount: 320000, currency: 'CZK' }, 1);
    doc = put(doc, 'budgets', { id: 'b2', categoryId: 'cat_housing', amount: 700000, currency: 'CZK' }, 1); // covered by the dorm bill

    it('adds recurring bills and the budgets no bill covers', () => {
        const bills = convertMinor(630000, 'CZK', 'TRY', fx) + convertMinor(2000, 'USD', 'TRY', fx);
        expect(monthlyCost(doc, TODAY, 'TRY', fx)).toEqual({ basis: 'budget', bills, budgets: 800000, total: bills + 800000 });
        expect(monthlyCost(doc, TODAY, 'TRY', fx, 'bills')).toEqual({ basis: 'bills', bills, budgets: 0, total: bills });
    });
    it('ignores one-off purchases', () => {
        const withLaptop = put(doc, 'tx', { id: 'laptop', type: 'expense', amount: 5000000, currency: 'TRY', date: '2026-10-05', categoryId: 'cat_electronics' }, 1);
        expect(monthlyCost(withLaptop, TODAY, 'TRY', fx)).toEqual(monthlyCost(doc, TODAY, 'TRY', fx));
    });
    it('is null with nothing planned', () => {
        expect(monthlyCost(withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 }), TODAY, 'TRY', fx)).toBeNull();
    });
});

describe('what the income buys', () => {
    const rule = { id: 'salary', type: 'income', amount: 6000000, currency: 'TRY', dayOfMonth: 1, startMonth: '2026-08' };
    let doc = withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 });
    doc = put(doc, 'rules', rule, 1);
    doc = put(doc, 'tx', { id: occurrenceId('salary', '2026-10'), ruleId: 'salary', ruleMonth: '2026-10', type: 'income', amount: 5500000, currency: 'TRY', date: '2026-10-01' }, 1);
    doc = put(doc, 'fxDays', { id: '2026-10-01', rates: { USD: '1', TRY: '49', CZK: '21' }, overrides: {} }, 1);
    const months = [
        { month: '2026-09', rates: { USD: '1', TRY: '48', CZK: '21' } },
        { month: '2026-10', rates: { USD: '1', TRY: '49.5', CZK: '21.5' } },
        { month: '2026-11', rates: { USD: '1', TRY: '50', CZK: '20' } },
    ];
    const rows = incomeBuys(doc, rule, months, ['CZK', 'USD']);

    it('uses the salary recorded that month, at its own day\'s rate', () => {
        expect(rows[1].assumed).toBe(false);
        expect(rows[1].values.CZK).toBe(convertMinor(5500000, 'TRY', 'CZK', { rates: { USD: '1', TRY: '49', CZK: '21' } }));
    });
    it('falls back to today\'s salary, marked as assumed', () => {
        expect(rows[0].assumed).toBe(true);
        expect(rows[0].values.USD).toBe(125000);                          // 60,000 / 48
        expect(rows[2].assumed).toBe(true);
    });
    it('compares each month with the first one shown', () => {
        expect(rows[0].change.USD).toBeNull();
        expect(rows[2].change.USD).toBeCloseTo(120000 / 125000 - 1, 6);
    });
});

describe('currency lists', () => {
    it('leaves out currencies no longer in circulation', () => {
        const all = allCurrencyCodes();
        for (const gone of ['ATS', 'BEF', 'AZM', 'DEM', 'FRF', 'HRK', 'BGN', 'CUC', 'ZWL', 'SLL', 'VEF', 'XAU', 'XXX']) expect(all).not.toContain(gone);
        for (const code of ['TRY', 'CZK', 'EUR', 'USD', 'UAH', 'GBP', 'PLN', 'XOF']) expect(all).toContain(code);
        expect(currencyChoices(['UAH', 'USD'], null).rest).not.toContain('ATS');
    });
});
