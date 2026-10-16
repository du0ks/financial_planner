import { describe, expect, it } from 'vitest';
import { emptyDoc, put, putSetting } from '../doc';
import { withDefaults } from '../defaults';
import { buildModel } from '../model';
import { convertMinor, equivalents, pairRate } from '../fx';
import { fxForDate, occurrenceId, txAmountIn } from '../ledger';
import { currencyChoices, sumMinor } from '../money';
import { datesNeedingRates } from '../../state/actions';

// Real published rates (units per 1 USD) for two days, so the tests read like the app's data.
const OCT_16 = { USD: '1', TRY: '49.50379267', CZK: '21.66332137', EUR: '0.88987006', UAH: '44.90175447', XAU: '0.0002390663' };
const SEP_15 = { USD: '1', TRY: '48.63291322', CZK: '21.05731939', EUR: '0.86687572', UAH: '44.69587593', XAU: '0.0002323151' };
const fx = { rates: OCT_16, overrides: {} };

describe('USD and UAH conversions', () => {
    it('converts every pair through USD', () => {
        expect(convertMinor(2000, 'USD', 'TRY', fx)).toBe(99008);        // $20 → ₺990.08
        expect(convertMinor(2000, 'USD', 'CZK', fx)).toBe(43327);        // $20 → 433.27 Kč
        expect(convertMinor(2000, 'USD', 'UAH', fx)).toBe(89804);        // $20 → ₴898.04
        expect(convertMinor(100000, 'UAH', 'USD', fx)).toBe(2227);       // ₴1,000 → $22.27
        expect(convertMinor(10000, 'EUR', 'UAH', fx)).toBe(504588);      // €100 → ₴5,045.88
        expect(convertMinor(100000, 'CZK', 'UAH', fx)).toBe(207271);     // 1,000 Kč → ₴2,072.71
        expect(convertMinor(100000, 'UAH', 'CZK', fx)).toBe(48246);      // ₴1,000 → 482.46 Kč
        expect(convertMinor(100000, 'UAH', 'TRY', fx)).toBe(110249);     // ₴1,000 → ₺1,102.49
    });
    it('keeps a round trip into a smaller unit within one minor unit', () => {
        for (const [from, to] of [['USD', 'UAH'], ['EUR', 'UAH'], ['CZK', 'UAH'], ['USD', 'TRY'], ['USD', 'CZK'], ['UAH', 'TRY']]) {
            const there = convertMinor(123456, from, to, fx);
            expect(Math.abs(convertMinor(there, to, from, fx) - 123456)).toBeLessThanOrEqual(1);
        }
    });
    it('applies a manual UAH override in both directions', () => {
        const manual = { ...fx, overrides: { 'USD/UAH': '41.50' } };
        expect(convertMinor(2000, 'USD', 'UAH', manual)).toBe(83000);
        expect(convertMinor(83000, 'UAH', 'USD', manual)).toBe(2000);
        expect(pairRate('EUR', 'UAH', manual).toFixed(4)).toBe(pairRate('EUR', 'UAH', fx).toFixed(4));
    });
    it('shows an amount in the other currencies, with the rate used', () => {
        const list = equivalents(2000, 'USD', ['TRY', 'TRY', 'CZK', 'EUR', 'USD'], fx);
        expect(list.map((e) => [e.code, e.minor])).toEqual([['TRY', 99008], ['CZK', 43327], ['EUR', 1780]]);
        expect(list[0].rate.toFixed(2)).toBe('49.50');
        expect(equivalents(2000, 'USD', ['UAH', 'GBP'], fx).map((e) => e.code)).toEqual(['UAH']);
    });
});

describe('historical rates for USD and UAH entries', () => {
    let doc = withDefaults(emptyDoc(), { displayCurrency: 'TRY', at: 1 });
    doc = putSetting(doc, 'currencies', ['TRY', 'CZK', 'EUR', 'USD'], 1);
    doc = put(doc, 'rules', { id: 'ai', type: 'expense', name: 'AI', amount: 2000, currency: 'USD', dayOfMonth: 15, startMonth: '2026-09', categoryId: 'cat_subscriptions' }, 1);
    const sep = { id: occurrenceId('ai', '2026-09'), ruleId: 'ai', ruleMonth: '2026-09', type: 'expense', amount: 2000, currency: 'USD', date: '2026-09-15', createdAt: 2 };
    doc = put(doc, 'tx', sep, 2);

    it('asks for that day\'s rate for every currency the user holds', () => {
        expect(datesNeedingRates(doc)).toEqual([{ date: '2026-09-15', codes: ['TRY', 'CZK', 'EUR', 'USD'] }]);
    });
    it('converts a month\'s entry at its own frozen rate, not today\'s', () => {
        const frozen = put(doc, 'fxDays', { id: '2026-09-15', rates: SEP_15, overrides: {} }, 3);
        expect(datesNeedingRates(frozen)).toEqual([]);
        expect(txAmountIn(sep, 'TRY', frozen, fx)).toBe(97266);         // at 48.63, not 49.50
        expect(txAmountIn(sep, 'CZK', frozen, fx)).toBe(42115);
        expect(txAmountIn(sep, 'TRY', doc, fx)).toBe(99008);            // not frozen yet → today
    });
    it('works for a UAH user with USD items', () => {
        let hers = withDefaults(emptyDoc(), { displayCurrency: 'UAH', at: 1 });
        const tx = { id: 't', type: 'expense', amount: 1500, currency: 'USD', date: '2026-09-15', createdAt: 2 };
        hers = put(hers, 'tx', tx, 2);
        expect(datesNeedingRates(hers)).toEqual([{ date: '2026-09-15', codes: ['UAH', 'USD'] }]);
        hers = put(hers, 'fxDays', { id: '2026-09-15', rates: { USD: '1', UAH: SEP_15.UAH }, overrides: {} }, 3);
        expect(txAmountIn(tx, 'UAH', hers, fx)).toBe(67044);             // $15 at 44.70
        // A currency added later falls back to today's rate until its own day rate arrives.
        expect(fxForDate(hers, '2026-09-15', fx).rates.UAH).toBe(SEP_15.UAH);
        expect(txAmountIn(tx, 'CZK', hers, fx)).toBe(32495);
    });
});

describe('currency pickers', () => {
    it('lists the user\'s own currencies first, then all others', () => {
        const { own, rest } = currencyChoices(['TRY', 'CZK', 'EUR', 'USD'], OCT_16);
        expect(own).toEqual(['TRY', 'CZK', 'EUR', 'USD']);
        expect(rest).toEqual(['UAH']);                                    // only codes with a rate
        const offline = currencyChoices(['UAH', 'USD'], null);
        expect(offline.own).toEqual(['UAH', 'USD']);
        expect(offline.rest).toEqual(expect.arrayContaining(['TRY', 'CZK', 'EUR', 'GBP']));
        expect(offline.rest).not.toContain('UAH');
        expect(offline.rest).not.toContain('XAU');
    });
    it('keeps a picked currency visible even if it is not one of the user\'s', () => {
        expect(currencyChoices(['UAH', 'USD'], OCT_16, 'CZK').own).toEqual(['UAH', 'USD', 'CZK']);
    });
    it('gives every new account USD next to its own currency', () => {
        expect(withDefaults(emptyDoc(), { displayCurrency: 'UAH', at: 1 }).settings.currencies.value).toEqual(['UAH', 'USD']);
        expect(withDefaults(emptyDoc(), { displayCurrency: 'USD', at: 1 }).settings.currencies.value).toEqual(['USD']);
    });
});

// ---------------------------------------------------------------------------------------------

const TODAY = '2026-11-10';

function portfolio(display) {
    let doc = withDefaults(emptyDoc(), { displayCurrency: display, at: 1 });
    doc = putSetting(doc, 'currencies', ['TRY', 'CZK', 'EUR', 'USD', 'UAH'], 1);
    const acct = (id, currency, kind, amount, extra = {}) => {
        doc = put(doc, 'accounts', { id, name: id, currency, kind, ...extra }, 1);
        doc = put(doc, 'anchors', { id: `a_${id}`, accountId: id, amount, date: '2026-11-01', setAt: 5 }, 5);
    };
    acct('ziraat', 'TRY', 'bank', 1234567);
    acct('wiseCzk', 'CZK', 'ewallet', 456789);
    acct('wiseUsd', 'USD', 'ewallet', 12345);
    acct('eurCash', 'EUR', 'cash', 40000);
    acct('czkCash', 'CZK', 'cash', 150000);
    acct('uahCash', 'UAH', 'cash', 250000);
    acct('fund', 'TRY', 'investment', 987654, { available: false });
    acct('savings', 'EUR', 'bank', 50000, { available: false });
    acct('deposit', 'CZK', 'other', 1200000, { available: true }); // 'other' never counts as available
    acct('ziraatCard', 'TRY', 'credit', -345678, { linkedAccountId: 'ziraat', limit: 5000000 });
    acct('isCard', 'TRY', 'credit', 12000, { limit: 1000000 });     // overpaid: your money on the card
    doc = put(doc, 'goldEvents', { id: 'g1', type: 'adjust', date: '2026-11-01', mg: 6800, portionId: 'portion_available' }, 6);
    doc = put(doc, 'goldEvents', { id: 'g2', type: 'adjust', date: '2026-11-01', mg: 31103, portionId: 'portion_longterm' }, 6);
    doc = put(doc, 'rules', { id: 'salary', type: 'income', amount: 6000000, currency: 'TRY', dayOfMonth: 25, startMonth: '2026-11', accountId: 'ziraat', categoryId: 'cat_salary' }, 1);
    doc = put(doc, 'rules', { id: 'dorm', type: 'expense', amount: 630000, currency: 'CZK', dayOfMonth: 20, startMonth: '2026-11', accountId: 'wiseCzk', categoryId: 'cat_housing' }, 1);
    doc = put(doc, 'rules', { id: 'ai', type: 'expense', amount: 2000, currency: 'USD', dayOfMonth: 15, startMonth: '2026-11', accountId: 'ziraatCard', categoryId: 'cat_subscriptions' }, 1);
    const debt = (id, amount, currency, direction, certainty) => {
        doc = put(doc, 'tx', { id, type: 'expense', amount, currency, date: '2026-11-03', accountId: null, categoryId: 'cat_other', note: id, debt: { direction, certainty, status: 'open' }, createdAt: 1 }, 1);
    };
    debt('fridge', 340000, 'CZK', 'iOwe', 'possible');
    debt('rent share', 50000, 'EUR', 'iOwe', 'certain');
    debt('lent to friend', 1000000, 'UAH', 'owedToMe', 'certain');
    debt('maybe back', 20000, 'EUR', 'owedToMe', 'possible');
    return buildModel(doc, OCT_16, TODAY);
}

describe('total assets breakdown', () => {
    for (const display of ['TRY', 'CZK', 'UAH', 'USD']) {
        describe(`in ${display}`, () => {
            const model = portfolio(display);
            const groups = Object.fromEntries(model.assets.groups.map((g) => [g.key, g]));

            it('groups every asset once, in order', () => {
                expect(model.assets.groups.map((g) => g.key)).toEqual(['spendable', 'goldTouchable', 'goldUntouchable', 'investments', 'other']);
                expect(groups.spendable.items.map((i) => i.id)).toEqual(['czkCash', 'eurCash', 'uahCash', 'wiseCzk', 'wiseUsd', 'ziraat', 'isCard']);
                expect(groups.goldTouchable.items.map((i) => i.mg)).toEqual([6800]);
                expect(groups.goldUntouchable.items.map((i) => i.mg)).toEqual([31103]);
                expect(groups.investments.items.map((i) => i.id)).toEqual(['fund', 'savings']);
                expect(groups.other.items.map((i) => i.id)).toEqual(['deposit', 'lent to friend']);
            });
            it('keeps each item\'s own currency and its converted value', () => {
                const usd = groups.spendable.items.find((i) => i.id === 'wiseUsd');
                expect([usd.minor, usd.currency]).toEqual([12345, 'USD']);
                expect(usd.display).toBe(convertMinor(12345, 'USD', display, fx));
                const uah = groups.spendable.items.find((i) => i.id === 'uahCash');
                expect(uah.display).toBe(convertMinor(250000, 'UAH', display, fx));
            });
            it('sums items into groups and groups into the total', () => {
                for (const group of model.assets.groups) expect(group.total).toBe(sumMinor(group.items.map((i) => i.display)));
                expect(model.assets.total).toBe(sumMinor(model.assets.groups.map((g) => g.total)));
                expect(model.totals.totalAssets).toBe(model.assets.total);
            });
            it('walks from total assets to net worth and available now without a gap', () => {
                let running = 0;
                for (const step of model.chain) {
                    if (step.total) {
                        if (step.key !== 'assets') expect(step.minor).toBe(running);
                        running = step.minor;
                    } else {
                        expect(step.minor).toBeLessThanOrEqual(0);
                        running += step.minor;
                    }
                }
                const at = (key) => model.chain.find((s) => s.key === key)?.minor;
                expect(at('assets')).toBe(model.totals.totalAssets);
                expect(at('netWorth')).toBe(model.totals.netWorth);
                expect(at('availableNow')).toBe(model.totals.availableNow);
                expect(model.chain.map((s) => s.key)).toEqual(['assets', 'cards', 'iOwe', 'netWorth', 'goldUntouchable', 'investments', 'other', 'bills', 'availableNow']);
            });
            it('matches the stated definitions', () => {
                const t = model.totals;
                expect(t.netWorth).toBe(t.totalAssets - t.totalCardDebt - t.iOweCertain);
                expect(t.availableNow).toBe(groups.spendable.total + groups.goldTouchable.total - t.totalCardDebt - t.iOweCertain - t.billsDue);
                // Bills before the 25th payday: the dorm and the USD AI subscription.
                expect(model.bills.items.map((b) => b.rule.id).sort()).toEqual(['ai', 'dorm']);
                expect(t.billsDue).toBe(convertMinor(630000, 'CZK', display, fx) + convertMinor(2000, 'USD', display, fx));
            });
            it('shows possible debts but never subtracts them', () => {
                expect(model.possibleDebts.map((d) => d.id)).toEqual(['fridge']);
                expect(model.totals.iOwePossible).toBe(convertMinor(340000, 'CZK', display, fx));
                expect(model.chain.some((s) => s.key === 'possible')).toBe(false);
                expect(groups.other.items.some((i) => i.id === 'maybe back')).toBe(false);
            });
        });
    }

    it('follows the display currency switch', () => {
        const inTry = portfolio('TRY');
        for (const display of ['CZK', 'UAH', 'USD', 'EUR']) {
            const other = portfolio(display);
            for (const key of ['totalAssets', 'netWorth', 'availableNow']) {
                const converted = convertMinor(inTry.totals[key], 'TRY', display, fx);
                // Each item is rounded once in each currency; allow one minor unit per item.
                expect(Math.abs(other.totals[key] - converted)).toBeLessThanOrEqual(20);
            }
        }
    });
});
