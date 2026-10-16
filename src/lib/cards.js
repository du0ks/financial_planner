import Big from 'big.js';
import { scaleMinor } from './money';

// Card interest, per card. Each card carries its own terms; a preset fills them in.
//
// Turkey (BDDK rules, as Turkish banks' worked examples show): if the whole statement is not
// paid by the due date, contractual interest (akdi faiz) runs on the UNPAID remainder only,
// from the statement date to the next one. KKDF 15% + BSMV 15% are charged on that interest.
// Paying less than the minimum adds late interest (gecikme faizi, about 0.30 points higher)
// on the unpaid part of the minimum.
//
// Generic: no taxes; the user types the bank's numbers. Many banks outside Turkey drop the
// grace period on the whole statement when it is not paid in full, so the interest base is a
// per-card choice: 'remainder' (only what is left unpaid) or 'statement' (the whole statement).
//
// terms { monthlyRatePct, taxPct, minPct, minFloor (minor), interestBase, lateExtraPct }

export const PRESETS = {
    turkey: { taxPct: '30', minPct: '20', minFloor: 0, interestBase: 'remainder', lateExtraPct: '0.30' },
    generic: { taxPct: '0', minPct: '5', minFloor: 0, interestBase: 'statement', lateExtraPct: '0' },
};

const pct = (value) => new Big(value || 0).div(100);

/** A card's preset: the one saved on it, or Turkey for cards made before presets existed. */
export function cardPreset(card) {
    if (card?.rulePreset && PRESETS[card.rulePreset]) return card.rulePreset;
    return card?.taxRate === undefined || card?.taxRate === '30' ? 'turkey' : 'generic';
}

/** The interest terms of a card, with the preset filling anything the card leaves blank. */
export function cardTerms(card) {
    const preset = PRESETS[cardPreset(card)];
    return {
        monthlyRatePct: card?.monthlyRate || null,
        taxPct: card?.taxRate ?? preset.taxPct,
        minPct: card?.minPaymentPct ?? preset.minPct,
        minFloor: card?.minPaymentFloor ?? preset.minFloor,
        interestBase: card?.interestBase || preset.interestBase,
        lateExtraPct: card?.lateExtraPct ?? preset.lateExtraPct,
    };
}

/** Real monthly cost as a fraction (0.04875 for 3.75% with 30% tax on interest). */
export function effectiveMonthlyRate(monthlyRatePct, taxPct = '0') {
    return pct(monthlyRatePct).times(new Big(1).plus(pct(taxPct)));
}

/** Compounded yearly cost of a monthly fraction, as a Big fraction. */
export function effectiveAnnualRate(monthlyFraction) {
    return new Big(1).plus(monthlyFraction).pow(12).minus(1);
}

/** The least the bank accepts on a statement: a share of it, at least the fixed floor. */
export function minimumPayment(statement, terms) {
    if (statement <= 0) return 0;
    const share = scaleMinor(statement, pct(terms.minPct));
    const minimum = Math.max(share, terms.minFloor || 0);
    // A share that rounds to nothing can never clear the last kuruş; the bank asks for all of it.
    return minimum <= 0 ? statement : Math.min(statement, minimum);
}

/**
 * Interest (taxes included) charged at the next statement after paying `paid` against a
 * statement of `statement`, both in minor units. Zero when the statement is paid in full.
 */
export function cycleInterest(statement, paid, terms) {
    if (statement <= 0 || paid >= statement || !terms.monthlyRatePct) return 0;
    const unpaid = statement - Math.max(0, paid);
    const base = terms.interestBase === 'statement' ? statement : unpaid;
    let interest = scaleMinor(base, effectiveMonthlyRate(terms.monthlyRatePct, terms.taxPct));
    const shortOfMinimum = minimumPayment(statement, terms) - Math.max(0, paid);
    if (shortOfMinimum > 0 && Number(terms.lateExtraPct) > 0) {
        interest += scaleMinor(shortOfMinimum, effectiveMonthlyRate(terms.lateExtraPct, terms.taxPct));
    }
    return interest;
}

/** Interest on the next statement if only the minimum is paid on `debt`. */
export function interestIfMinimum(debt, terms) {
    return cycleInterest(debt, minimumPayment(debt, terms), terms);
}

/**
 * Month-by-month payoff of a card balance, starting from a statement of `balance`. Each month
 * the payment comes off the statement, then interest is charged as `cycleInterest` says and
 * lands on the next statement. No new spending. Strategies:
 *   { type: 'full' }                  — pay the whole statement, no interest
 *   { type: 'minimum' }               — the card's minimum payment every month
 *   { type: 'fixed', amount: minor }  — the same amount every month
 * Returns months to zero, total interest, total paid, and whether it ever reaches zero.
 */
export function simulatePayoff({ balance, terms, strategy, maxMonths = 600 }) {
    if (!balance || balance <= 0) return { months: 0, interest: 0, paid: 0, paidOff: true, belowMinimum: false, schedule: [] };
    let statement = balance;
    let interest = 0;
    let paid = 0;
    let belowMinimum = false;
    const schedule = [];

    for (let month = 1; month <= maxMonths; month += 1) {
        const minimum = minimumPayment(statement, terms);
        let payment = statement;
        if (strategy.type === 'minimum') payment = minimum;
        if (strategy.type === 'fixed') payment = Math.min(statement, strategy.amount || 0);
        if (payment < minimum) belowMinimum = true;

        const charge = cycleInterest(statement, payment, terms);
        paid += payment;
        interest += charge;
        const next = statement - payment + charge;
        schedule.push({ month, statement, payment, interest: charge, balance: next });
        if (next <= 0) return { months: month, interest, paid, paidOff: true, belowMinimum, schedule };
        if (next >= statement) return { months: null, interest: null, paid: null, paidOff: false, belowMinimum, schedule };
        statement = next;
    }
    return { months: null, interest, paid, paidOff: false, belowMinimum, schedule };
}

/**
 * Several cards paid from one monthly amount, in one currency (the display currency): every
 * card gets its minimum, and whatever is left goes to the card with the highest real rate
 * first (the avalanche order, which costs the least interest).
 * cards: [{ id, balance, terms }]. Returns months, total interest, the order, and
 * `short` when the amount does not even cover the minimums.
 */
export function payoffOrder(cards) {
    const rate = (c) => (c.terms.monthlyRatePct ? effectiveMonthlyRate(c.terms.monthlyRatePct, c.terms.taxPct) : new Big(0));
    return [...cards]
        .filter((c) => c.balance > 0)
        .sort((a, b) => rate(b).cmp(rate(a)) || Number(b.terms.interestBase === 'statement') - Number(a.terms.interestBase === 'statement') || b.balance - a.balance);
}

export function simulateAllCards({ cards, monthly, maxMonths = 600 }) {
    const order = payoffOrder(cards);
    const balances = Object.fromEntries(order.map((c) => [c.id, c.balance]));
    const paidOffIn = {};
    let interest = 0;
    let short = false;
    for (let month = 1; month <= maxMonths; month += 1) {
        const open = order.filter((c) => balances[c.id] > 0);
        if (!open.length) return { months: month - 1, interest, order, paidOffIn, short, paidOff: true };
        const payments = {};
        let left = monthly;
        for (const c of open) {
            const minimum = minimumPayment(balances[c.id], c.terms);
            payments[c.id] = Math.min(minimum, left);
            if (payments[c.id] < minimum) short = true;
            left -= payments[c.id];
        }
        for (const c of open) {
            if (left <= 0) break;
            const extra = Math.min(left, balances[c.id] - payments[c.id]);
            payments[c.id] += extra;
            left -= extra;
        }
        const before = sumOf(open.map((c) => balances[c.id]));
        for (const c of open) {
            const charge = cycleInterest(balances[c.id], payments[c.id], c.terms);
            interest += charge;
            balances[c.id] = balances[c.id] - payments[c.id] + charge;
            if (balances[c.id] <= 0 && !paidOffIn[c.id]) paidOffIn[c.id] = month;
        }
        if (sumOf(open.map((c) => balances[c.id])) >= before) return { months: null, interest: null, order, paidOffIn, short, paidOff: false };
    }
    return { months: null, interest, order, paidOffIn, short, paidOff: false };
}

const sumOf = (values) => values.reduce((a, b) => a + b, 0);
