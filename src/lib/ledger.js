import { convertOrZero } from './fx';
import { get, list } from './doc';
import { addDays, addMonths, dayInMonth, monthOf } from './dates';

// Record shapes (amounts are integer minor units of the record's own currency):
//
// account  { name, kind: bank|cash|ewallet|investment|other|credit, currency, available,
//            linkedAccountId (credit → the deposit account at the same bank), limit,
//            monthlyRate, taxRate, minPaymentPct, statementDay, dueDay, lastStatement, note }
//          A credit account's balance is negative while you owe money on it.
// anchor   { accountId, amount, date, setAt } — a balance you typed in. The newest anchor of
//          an account is its starting point; transactions after it move the balance.
// tx       { type: expense|income|transfer, date, amount, currency, accountId,
//            toAccountId, toAmount (transfer, in the destination account's currency),
//            categoryId, note, recurring, ruleId, ruleMonth, skipped,
//            debt: { direction: iOwe|owedToMe, certainty: possible|certain, status: open|settled|cancelled, who },
//            settlesTxId — a payment that settles an earlier debt, so it is not spending twice }
// rule     { type: expense|income, name, amount, currency, accountId, categoryId,
//            dayOfMonth, startMonth, endMonth, variable }

export const CREDIT = 'credit';
/** Anything else owned (a deposit, a car). Never counted as money you can use. */
export const OTHER = 'other';

/**
 * The frozen rates of a transaction's date, or today's when that day was never fetched. A
 * currency added after the day was frozen falls back to today's rate until its own rate for
 * that day is fetched.
 */
export function fxForDate(doc, date, latestFx) {
    const day = get(doc, 'fxDays', date);
    if (!day) return latestFx;
    return { rates: { ...(latestFx?.rates || {}), ...day.rates }, overrides: day.overrides || {} };
}

/** A transaction's amount in another currency, at the rate of the day it happened. */
export function txAmountIn(tx, currency, doc, latestFx, missing) {
    return convertOrZero(tx.amount, tx.currency, currency, fxForDate(doc, tx.date, latestFx), missing);
}

const counts = (tx) => tx && !tx.deleted && !tx.skipped;

export function latestAnchor(doc, accountId) {
    let best = null;
    for (const anchor of list(doc, 'anchors')) {
        if (anchor.accountId !== accountId) continue;
        if (!best || anchor.setAt > best.setAt) best = anchor;
    }
    return best;
}

/** True when a transaction happened after the balance was last typed in. */
export function isAfterAnchor(tx, anchor) {
    if (!anchor) return true;
    if (tx.date !== anchor.date) return tx.date > anchor.date;
    return (tx.createdAt || 0) > anchor.setAt;
}

/** The signed effect of one transaction on each account it touches, in that account's currency. */
export function txEffects(tx, doc, latestFx, missing) {
    if (!counts(tx)) return [];
    const effects = [];
    const accountCurrency = (id) => get(doc, 'accounts', id)?.currency;
    const fx = fxForDate(doc, tx.date, latestFx);

    const add = (accountId, minor, currency) => {
        const target = accountCurrency(accountId);
        if (!target) return;
        effects.push({ accountId, minor: convertOrZero(minor, currency, target, fx, missing) });
    };

    if (tx.type === 'expense' && tx.accountId) add(tx.accountId, -tx.amount, tx.currency);
    if (tx.type === 'income' && tx.accountId) add(tx.accountId, tx.amount, tx.currency);
    if (tx.type === 'transfer') {
        if (tx.accountId) add(tx.accountId, -tx.amount, tx.currency);
        if (tx.toAccountId) {
            const target = accountCurrency(tx.toAccountId);
            if (target && tx.toAmount !== undefined && tx.toAmount !== null) {
                effects.push({ accountId: tx.toAccountId, minor: tx.toAmount });
            } else {
                add(tx.toAccountId, tx.amount, tx.currency);
            }
        }
    }
    return effects;
}

/** Current balance of every account, in its own currency. */
export function accountBalances(doc, latestFx, missing) {
    const balances = {};
    const anchors = {};
    for (const account of list(doc, 'accounts')) {
        const anchor = latestAnchor(doc, account.id);
        anchors[account.id] = anchor;
        balances[account.id] = anchor ? anchor.amount : 0;
    }
    for (const tx of list(doc, 'tx')) {
        for (const effect of txEffects(tx, doc, latestFx, missing)) {
            if (!(effect.accountId in balances)) continue;
            if (isAfterAnchor(tx, anchors[effect.accountId])) balances[effect.accountId] += effect.minor;
        }
    }
    return balances;
}

export const cardDebt = (balance) => Math.max(0, -(balance || 0));

// ---------- What counts as spending / income ----------

/** Real spending: not a transfer, not a skipped bill, not paying back a debt already counted,
 *  not money you laid out for someone who will pay it back. */
export function isSpending(tx) {
    return counts(tx) && tx.type === 'expense' && !tx.settlesTxId && tx.debt?.direction !== 'owedToMe';
}

export function isIncome(tx) {
    return counts(tx) && tx.type === 'income' && !tx.settlesTxId;
}

export function txInMonth(doc, month) {
    return list(doc, 'tx').filter((tx) => monthOf(tx.date) === month);
}

// ---------- Recurring rules ----------

export const occurrenceId = (ruleId, month) => `r_${ruleId}_${month}`;

export function ruleActiveIn(rule, month) {
    if (rule.startMonth && month < rule.startMonth) return false;
    if (rule.endMonth && month > rule.endMonth) return false;
    return true;
}

/** Every rule's occurrence in a month, with the transaction that settled it, if any. */
export function occurrencesIn(doc, month) {
    return list(doc, 'rules')
        .filter((rule) => ruleActiveIn(rule, month))
        .map((rule) => {
            const tx = doc.tx?.[occurrenceId(rule.id, month)];
            return {
                rule,
                month,
                date: dayInMonth(month, rule.dayOfMonth),
                tx: tx && !tx.deleted ? tx : null,
                done: Boolean(tx && !tx.deleted),
            };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
}

/** Occurrences still waiting to be confirmed between two dates (inclusive). */
export function pendingOccurrences(doc, fromDate, toDate, { type } = {}) {
    const out = [];
    for (let month = monthOf(fromDate); month <= monthOf(toDate); month = addMonths(month, 1)) {
        for (const occurrence of occurrencesIn(doc, month)) {
            if (occurrence.done) continue;
            if (type && occurrence.rule.type !== type) continue;
            if (occurrence.date < fromDate || occurrence.date > toDate) continue;
            out.push(occurrence);
        }
    }
    return out;
}

/** The next date a recurring income lands, on or after `fromDate`. */
export function nextIncomeDate(doc, fromDate) {
    let best = null;
    for (let i = 0; i < 3; i += 1) {
        const month = addMonths(monthOf(fromDate), i);
        for (const occurrence of occurrencesIn(doc, month)) {
            if (occurrence.rule.type !== 'income' || occurrence.done) continue;
            if (occurrence.date < fromDate) continue;
            if (!best || occurrence.date < best) best = occurrence.date;
        }
        if (best) return best;
    }
    return best;
}

/** Bills not yet confirmed: anything overdue this month, plus everything due before the next payday. */
export function billsDueBeforePayday(doc, todayDate) {
    const payday = nextIncomeDate(doc, addDays(todayDate, 1));
    const until = payday ? addDays(payday, -1) : addDays(todayDate, 30);
    const from = `${monthOf(todayDate)}-01`;
    return { payday, items: pendingOccurrences(doc, from, until, { type: 'expense' }) };
}

// ---------- Debts between people ----------

export function openDebts(doc) {
    return list(doc, 'tx').filter((tx) => counts(tx) && tx.debt && tx.debt.status === 'open');
}
