import Big from 'big.js';
import { scaleMinor } from './money';

// Turkish card interest: the contractual monthly rate, plus KKDF (15%) and BSMV (15%) charged
// on the interest itself, so the real monthly cost is rate × 1.30.

export const DEFAULT_TAX_PCT = '30';
export const DEFAULT_MIN_PAYMENT_PCT = '20';

const pct = (value) => new Big(value || 0).div(100);

/** Real monthly cost as a fraction (0.04875 for 3.75% with 30% tax on interest). */
export function effectiveMonthlyRate(monthlyRatePct, taxPct = DEFAULT_TAX_PCT) {
    return pct(monthlyRatePct).times(new Big(1).plus(pct(taxPct)));
}

/** Compounded yearly cost of a monthly fraction, as a Big fraction. */
export function effectiveAnnualRate(monthlyFraction) {
    return new Big(1).plus(monthlyFraction).pow(12).minus(1);
}

/** One month of interest on a balance, in minor units. */
export function monthlyInterest(balanceMinor, monthlyRatePct, taxPct = DEFAULT_TAX_PCT) {
    return scaleMinor(balanceMinor, effectiveMonthlyRate(monthlyRatePct, taxPct));
}

/**
 * Month-by-month payoff of a card balance. Each month interest is charged on what is still
 * owed, then the payment comes off. Strategies:
 *   { type: 'full' }                               — pay the whole statement, no interest
 *   { type: 'minimum', pct: '20', floor: minor }   — a share of the balance, at least `floor`
 *   { type: 'fixed', amount: minor }               — the same amount every month
 * Returns months to zero, total interest, total paid, and whether it ever reaches zero.
 */
export function simulatePayoff({ balance, monthlyRatePct, taxPct = DEFAULT_TAX_PCT, strategy, maxMonths = 600 }) {
    if (!balance || balance <= 0) return { months: 0, interest: 0, paid: 0, paidOff: true, schedule: [] };
    if (strategy.type === 'full') {
        return { months: 1, interest: 0, paid: balance, paidOff: true, schedule: [{ month: 1, interest: 0, payment: balance, balance: 0 }] };
    }

    const rate = effectiveMonthlyRate(monthlyRatePct, taxPct);
    let remaining = balance;
    let interest = 0;
    let paid = 0;
    const schedule = [];

    for (let month = 1; month <= maxMonths; month += 1) {
        const charge = scaleMinor(remaining, rate);
        remaining += charge;
        interest += charge;

        let payment;
        if (strategy.type === 'minimum') {
            payment = Math.max(scaleMinor(remaining, pct(strategy.pct ?? DEFAULT_MIN_PAYMENT_PCT)), strategy.floor || 0);
        } else {
            payment = strategy.amount || 0;
        }
        // The last kuruş can't be cleared by a percentage of itself; real banks ask for the remainder.
        if (payment <= 0 && remaining > 0) payment = remaining;
        payment = Math.min(payment, remaining);
        remaining -= payment;
        paid += payment;
        schedule.push({ month, interest: charge, payment, balance: remaining });

        if (remaining <= 0) return { months: month, interest, paid, paidOff: true, schedule };
        if (strategy.type === 'fixed' && payment <= charge) {
            return { months: null, interest: null, paid: null, paidOff: false, schedule };
        }
    }
    return { months: null, interest, paid, paidOff: false, schedule };
}
