import { describe, expect, it } from 'vitest';
import {
    PRESETS, cardPreset, cardTerms, cycleInterest, effectiveAnnualRate, effectiveMonthlyRate, interestIfMinimum,
    minimumPayment, payoffOrder, simulateAllCards, simulatePayoff,
} from '../cards';

const turkey = (rate = '3.75', extra = {}) => ({ ...PRESETS.turkey, monthlyRatePct: rate, ...extra });
const generic = (rate, extra = {}) => ({ ...PRESETS.generic, monthlyRatePct: rate, ...extra });

describe('card terms', () => {
    it('adds KKDF and BSMV to the contractual rate', () => {
        expect(effectiveMonthlyRate('3.75', '30').toString()).toBe('0.04875');
        expect(Number(effectiveAnnualRate(effectiveMonthlyRate('3.75', '30')).toFixed(4))).toBeCloseTo(0.7704, 4);
        expect(effectiveMonthlyRate('3.1', '0').toString()).toBe('0.031');
    });
    it('reads a card\'s own terms, with the preset filling the gaps', () => {
        expect(cardPreset({ taxRate: '30' })).toBe('turkey');
        expect(cardPreset({})).toBe('turkey'); // cards saved before presets were all Turkish
        expect(cardPreset({ rulePreset: 'generic', taxRate: '0' })).toBe('generic');
        expect(cardTerms({ rulePreset: 'generic', monthlyRate: '3.1', minPaymentPct: '5', minPaymentFloor: 10000 }))
            .toEqual({ monthlyRatePct: '3.1', taxPct: '0', minPct: '5', minFloor: 10000, interestBase: 'statement', lateExtraPct: '0' });
        expect(cardTerms({ monthlyRate: '3.75', taxRate: '30', minPaymentPct: '20' }).interestBase).toBe('remainder');
    });
    it('asks for a share of the statement, at least the fixed minimum, at most all of it', () => {
        expect(minimumPayment(3307117, turkey())).toBe(661423);
        expect(minimumPayment(100000, generic('3', { minFloor: 10000 }))).toBe(10000);   // 5% = 50 < 100 floor
        expect(minimumPayment(6000, generic('3', { minFloor: 10000 }))).toBe(6000);      // never more than owed
        expect(minimumPayment(1, turkey())).toBe(1);                                     // the last kuruş
    });
});

describe('Turkish interest: only the unpaid remainder', () => {
    // Yapı Kredi's worked examples: 1,000 TL statement, 40% minimum, 3.50% a month, late
    // interest 3.80%, 10 days from statement to due date and 20 days to the next statement.
    const bank = turkey('3.50', { minPct: '40', taxPct: '0' });
    it('charges interest on what was left unpaid, not on the whole statement', () => {
        // Bank: 600 × 3.5% × 10/30 + 600 × 3.5% × 20/30 = 7.00 + 14.00 = 21.00 TL
        expect(cycleInterest(100000, 40000, bank)).toBe(2100);
        expect(cycleInterest(100000, 70000, bank)).toBe(1050);
    });
    it('charges nothing when the statement is paid in full', () => {
        expect(cycleInterest(100000, 100000, bank)).toBe(0);
        expect(cycleInterest(100000, 120000, bank)).toBe(0);
    });
    it('adds late interest on the unpaid part of the minimum', () => {
        // Bank: 10.50 + 7.60 + 14.00 = 32.10 TL; we charge the late extra for the whole month.
        expect(cycleInterest(100000, 10000, bank)).toBe(3150 + 90);
        // Bank: 11.67 + 10.13 + 14.00 = 35.80 TL
        expect(cycleInterest(100000, 0, bank)).toBe(3500 + 120);
    });
    it('puts KKDF and BSMV on top of the interest', () => {
        expect(cycleInterest(100000, 40000, { ...bank, taxPct: '30' })).toBe(2730);
    });
    it('charges the whole statement when a card is set to lose its grace period', () => {
        const whole = generic('3.1', { interestBase: 'statement' });
        expect(cycleInterest(100000, 40000, whole)).toBe(3100);
        expect(cycleInterest(100000, 100000, whole)).toBe(0);
    });
    it('estimates next month\'s interest if only the minimum is paid', () => {
        // 33,071.17 − 6,614.23 = 26,456.94 unpaid × 4.875% = 1,289.78
        expect(interestIfMinimum(3307117, turkey())).toBe(128978);
    });
});

describe('payoff simulator', () => {
    it('pays in full with no interest', () => {
        expect(simulatePayoff({ balance: 3307117, terms: turkey(), strategy: { type: 'full' } })).toMatchObject({ months: 1, interest: 0, paidOff: true });
    });
    it('charges the minimum-payment scenario on the remainder only', () => {
        const r = simulatePayoff({ balance: 3307117, terms: turkey(), strategy: { type: 'minimum' } });
        expect(r.paidOff).toBe(true);
        expect(r.paid - r.interest).toBe(3307117);
        // Month 1: pay 6,614.23, interest on the 26,456.94 left, not on 33,071.17.
        expect(r.schedule[0]).toMatchObject({ statement: 3307117, payment: 661423, interest: 128978, balance: 3307117 - 661423 + 128978 });
        expect(r.interest).toBe(801102);                       // ₺8,011, not the old ₺10,014
        const whole = simulatePayoff({ balance: 3307117, terms: turkey('3.75', { interestBase: 'statement' }), strategy: { type: 'minimum' } });
        expect(whole.interest).toBeGreaterThan(r.interest);
    });
    it('pays a fixed amount and flags one below the minimum', () => {
        const r = simulatePayoff({ balance: 1000000, terms: turkey(), strategy: { type: 'fixed', amount: 300000 } });
        expect(r).toMatchObject({ paidOff: true, months: 4, belowMinimum: false });
        expect(r.paid - r.interest).toBe(1000000);
        expect(simulatePayoff({ balance: 3307117, terms: turkey(), strategy: { type: 'fixed', amount: 500000 } }).belowMinimum).toBe(true);
    });
    it('reports a fixed payment below the interest as never paid off', () => {
        expect(simulatePayoff({ balance: 3307117, terms: turkey(), strategy: { type: 'fixed', amount: 100000 } }).paidOff).toBe(false);
    });
    it('a fixed minimum shortens a percentage-only payoff', () => {
        const pct = simulatePayoff({ balance: 3307117, terms: turkey(), strategy: { type: 'minimum' } });
        const floored = simulatePayoff({ balance: 3307117, terms: turkey('3.75', { minFloor: 50000 }), strategy: { type: 'minimum' } });
        expect(floored.months).toBeLessThan(pct.months);
        expect(floored.interest).toBeLessThan(pct.interest);
    });
    it('works for a UAH card with no taxes', () => {
        const r = simulatePayoff({ balance: 2000000, terms: generic('3.1', { minFloor: 10000 }), strategy: { type: 'fixed', amount: 500000 } });
        expect(r.paidOff).toBe(true);
        expect(r.schedule[0].interest).toBe(62000);            // whole ₴20,000 × 3.1%
    });
});

describe('all cards together', () => {
    const cards = [
        { id: 'uah', balance: 1000000, terms: generic('3.1', { minFloor: 10000 }) },
        { id: 'ziraat', balance: 3307117, terms: turkey('3.75') },
        { id: 'is', balance: 500000, terms: turkey('4.25') },
    ];
    it('pays the highest real rate first', () => {
        expect(payoffOrder(cards).map((c) => c.id)).toEqual(['is', 'ziraat', 'uah']);
    });
    it('clears everything from one monthly amount, costing less than minimums alone', () => {
        const r = simulateAllCards({ cards, monthly: 900000 });
        expect(r.paidOff).toBe(true);
        expect(r.short).toBe(false);
        expect(r.paidOffIn.is).toBeLessThanOrEqual(r.paidOffIn.ziraat);
        const minimumsOnly = cards.map((c) => simulatePayoff({ balance: c.balance, terms: c.terms, strategy: { type: 'minimum' } }).interest);
        expect(r.interest).toBeLessThan(minimumsOnly.reduce((a, b) => a + b, 0));
    });
    it('says when the amount does not cover the minimums', () => {
        expect(simulateAllCards({ cards, monthly: 300000 }).short).toBe(true);
    });
});
