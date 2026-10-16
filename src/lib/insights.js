import { list } from './doc';
import { addMonths, daysBetween, daysInMonth, monthOf, nextDayOfMonth } from './dates';
import { convertOrZero, pairRate, changeRatio, goldValueMinor } from './fx';
import { fxForDate, isIncome, isSpending, occurrencesIn, ruleActiveIn, txAmountIn, txInMonth } from './ledger';
import { convertMinor } from './fx';
import { sumMinor } from './money';
import { debtAmount } from './model';

// Month maths. Every amount is converted to the display currency at the rate of the day it
// happened (frozen in fxDays), so last month's totals don't move when rates do.

export function monthSpending(doc, month, currency, fx) {
    const byCategory = {};
    let recurring = 0;
    let oneOff = 0;
    const items = [];
    for (const tx of txInMonth(doc, month)) {
        if (!isSpending(tx)) continue;
        const value = txAmountIn(tx, currency, doc, fx);
        const key = tx.categoryId || 'cat_other';
        byCategory[key] = (byCategory[key] || 0) + value;
        if (tx.ruleId || tx.recurring) recurring += value;
        else oneOff += value;
        items.push({ tx, value });
    }
    items.sort((a, b) => b.value - a.value);
    return { total: recurring + oneOff, recurring, oneOff, byCategory, top: items.slice(0, 5), count: items.length };
}

export function monthIncome(doc, month, currency, fx) {
    return sumMinor(txInMonth(doc, month).filter(isIncome).map((tx) => txAmountIn(tx, currency, doc, fx)));
}

/** Budget amounts per category, in the display currency at today's rate. */
export function budgetsIn(doc, currency, fx) {
    const out = {};
    for (const budget of list(doc, 'budgets')) {
        out[budget.categoryId] = convertOrZero(budget.amount, budget.currency, currency, fx);
    }
    return out;
}

/**
 * How a month is going, category by category.
 *   pace      — what the budget allows by today, spread evenly over the month
 *   projected — spent so far + bills still to come + the day-to-day rate kept up to month end
 */
export function monthReport(doc, month, currency, fx, todayDate) {
    const spending = monthSpending(doc, month, currency, fx);
    const budgets = budgetsIn(doc, currency, fx);
    const total = daysInMonth(month);
    const isCurrent = monthOf(todayDate) === month;
    const isPast = month < monthOf(todayDate);
    const elapsed = isCurrent ? Number(todayDate.slice(8, 10)) : isPast ? total : 0;
    const remainingDays = total - elapsed;

    const pendingByCategory = {};
    for (const occurrence of occurrencesIn(doc, month)) {
        if (occurrence.done || occurrence.rule.type !== 'expense' || isPast) continue;
        const key = occurrence.rule.categoryId || 'cat_other';
        pendingByCategory[key] = (pendingByCategory[key] || 0) + convertOrZero(occurrence.rule.amount, occurrence.rule.currency, currency, fx);
    }
    const variableByCategory = {};
    for (const { tx, value } of allItems(doc, month, currency, fx)) {
        if (tx.ruleId || tx.recurring) continue;
        const key = tx.categoryId || 'cat_other';
        variableByCategory[key] = (variableByCategory[key] || 0) + value;
    }

    const categoryIds = new Set([...Object.keys(spending.byCategory), ...Object.keys(budgets), ...Object.keys(pendingByCategory)]);
    const rows = [...categoryIds].map((categoryId) => {
        const spent = spending.byCategory[categoryId] || 0;
        const budget = budgets[categoryId] ?? null;
        const pending = pendingByCategory[categoryId] || 0;
        const variable = variableByCategory[categoryId] || 0;
        const trend = elapsed > 0 && remainingDays > 0 ? Math.round((variable / elapsed) * remainingDays) : 0;
        const projected = spent + pending + trend;
        const pace = budget === null ? null : Math.round((budget * elapsed) / total);
        let status = 'ok';
        if (budget !== null) {
            if (spent > budget) status = 'over';
            else if (isCurrent && projected > budget) status = 'ahead';
        }
        return { categoryId, spent, budget, pending, projected, pace, status };
    }).sort((a, b) => (b.budget ?? b.spent) - (a.budget ?? a.spent));

    const income = monthIncome(doc, month, currency, fx);
    const pendingIncome = isPast ? 0 : sumMinor(occurrencesIn(doc, month)
        .filter((o) => !o.done && o.rule.type === 'income')
        .map((o) => convertOrZero(o.rule.amount, o.rule.currency, currency, fx)));
    const projectedSpending = sumMinor(rows.map((r) => r.projected));
    const budgetTotal = sumMinor(Object.values(budgets));
    const expectedIncome = income + pendingIncome;
    return {
        month,
        elapsed,
        totalDays: total,
        spending,
        rows,
        income,
        expectedIncome,
        budgetTotal,
        projectedSpending,
        savingsRate: expectedIncome > 0 ? (expectedIncome - projectedSpending) / expectedIncome : null,
    };
}

function allItems(doc, month, currency, fx) {
    return txInMonth(doc, month).filter(isSpending).map((tx) => ({ tx, value: txAmountIn(tx, currency, doc, fx) }));
}

export const COST_BASES = ['budget', 'bills'];

/**
 * What one normal month costs, from plans rather than history, so one-off purchases never
 * inflate it:
 *   bills   — recurring bills active this month
 *   budgets — monthly budgets for categories no recurring bill already covers
 * basis 'budget' counts both; 'bills' counts only the recurring bills (the bare minimum).
 * Returns null when there is nothing to base it on.
 */
export function monthlyCost(doc, todayDate, currency, fx, basis = 'budget') {
    const month = monthOf(todayDate);
    const rules = list(doc, 'rules').filter((r) => r.type === 'expense' && ruleActiveIn(r, month));
    const covered = new Set(rules.map((r) => r.categoryId));
    const bills = sumMinor(rules.map((r) => convertOrZero(r.amount, r.currency, currency, fx)));
    const budgets = sumMinor(Object.entries(budgetsIn(doc, currency, fx)).filter(([id]) => !covered.has(id)).map(([, v]) => v));
    const total = basis === 'bills' ? bills : bills + budgets;
    if (!total) return null;
    return { basis, bills, budgets: basis === 'bills' ? 0 : budgets, total };
}

/**
 * What one salary buys in other currencies, month by month. Uses the salary actually recorded
 * that month (at its own day's rate) when there is one, else today's salary at that month's
 * rate, marked `assumed`. `change` compares each value with the first month shown.
 * ratesByMonth: [{ month, rates }] for the first day of each month, oldest first.
 */
export function incomeBuys(doc, rule, ratesByMonth, targets) {
    const rows = ratesByMonth.map(({ month, rates }) => {
        const monthFx = { rates, overrides: {} };
        const recorded = txInMonth(doc, month).filter((tx) => isIncome(tx) && tx.ruleId === rule.id);
        const values = {};
        for (const code of targets) {
            values[code] = recorded.length
                ? sumMinor(recorded.map((tx) => convertMinor(tx.amount, tx.currency, code, fxForDate(doc, tx.date, monthFx)) ?? 0))
                : convertMinor(rule.amount, rule.currency, code, monthFx);
        }
        return { month, assumed: recorded.length === 0, values };
    });
    const first = rows[0];
    return rows.map((row) => ({
        ...row,
        change: Object.fromEntries(targets.map((code) => {
            const base = first?.values[code];
            const value = row.values[code];
            return [code, row === first || !base || value === null ? null : (value - base) / base];
        })),
    }));
}

/** Planned purchases' best guess: the middle of the estimate range. */
export const plannedEstimate = (item) => {
    if (item.min && item.max) return Math.round((item.min + item.max) / 2);
    return item.max || item.min || 0;
};

/**
 * Three months ahead: start from money available now, add expected income, subtract bills,
 * the budgeted day-to-day spending not already covered by a bill, and planned purchases.
 */
export function forecast(model, todayDate, months = 3) {
    const { doc, display, fx } = model;
    const budgets = budgetsIn(doc, display, fx);
    const ruleCategories = new Set(list(doc, 'rules').filter((r) => r.type === 'expense').map((r) => r.categoryId));
    const variableBudget = sumMinor(Object.entries(budgets).filter(([id]) => !ruleCategories.has(id)).map(([, v]) => v));
    const thisMonth = monthOf(todayDate);
    let balance = model.totals.availableNow + model.totals.billsDue; // billsDue is re-added below as month bills
    const rows = [];

    for (let i = 0; i < months; i += 1) {
        const month = addMonths(thisMonth, i);
        const occurrences = occurrencesIn(doc, month).filter((o) => !o.done && (i > 0 || o.date >= `${thisMonth}-01`));
        const income = sumMinor(occurrences.filter((o) => o.rule.type === 'income').map((o) => convertOrZero(o.rule.amount, o.rule.currency, display, fx)));
        const bills = sumMinor(occurrences.filter((o) => o.rule.type === 'expense').map((o) => convertOrZero(o.rule.amount, o.rule.currency, display, fx)));
        let dayToDay = variableBudget;
        if (i === 0) {
            // What is left of each day-to-day budget this month. Spending in a category with
            // no budget has already left the balance, so it doesn't eat into the others.
            const spent = monthSpending(doc, month, display, fx).byCategory;
            dayToDay = sumMinor(Object.entries(budgets)
                .filter(([id]) => !ruleCategories.has(id))
                .map(([id, budget]) => Math.max(0, budget - (spent[id] || 0))));
        }
        const purchases = list(doc, 'planned').filter((p) => p.status === 'planned' && p.month === month);
        const planned = sumMinor(purchases.map((p) => convertOrZero(plannedEstimate(p), p.currency, display, fx)));
        const start = balance;
        balance = balance + income - bills - dayToDay - planned;
        rows.push({ month, start, income, bills, dayToDay, planned, purchases, end: balance });
    }
    return rows;
}

/** Months in which more than `limit` big purchases are planned. */
export function bigPurchaseClashes(doc, limit = 1) {
    const byMonth = {};
    for (const item of list(doc, 'planned')) {
        if (item.status !== 'planned' || !item.big || !item.month) continue;
        (byMonth[item.month] ||= []).push(item);
    }
    return Object.entries(byMonth).filter(([, items]) => items.length > limit).map(([month, items]) => ({ month, items }));
}

/**
 * Plain-sentence alerts, most important first. `context` carries async facts the UI fetched:
 *   pastRates — rates from ~30 days ago, for the FX move check
 *   incomeCurrency — the currency salary arrives in
 */
export function buildAlerts(model, todayDate, context = {}) {
    const { doc, display, fx, totals } = model;
    const alerts = [];
    const report = monthReport(doc, monthOf(todayDate), display, fx, todayDate);

    // Debt detail lives on the Debts tab; here it is one line.
    const personal = model.debts.filter((d) => d.debt.direction === 'iOwe');
    if (model.totals.totalCardDebt > 0 || personal.length) {
        alerts.push({ key: 'debts', level: model.totals.cardInterestMonthly > 0 ? 'warn' : 'info', kind: 'debts', interest: model.totals.cardInterestMonthly, open: personal.length, link: 'debts' });
    }
    for (const card of model.cards) {
        if (card.debt > 0 && card.dueDay) {
            const due = nextDayOfMonth(todayDate, card.dueDay);
            const days = daysBetween(todayDate, due);
            if (days <= 7) alerts.push({ key: `card-due-${card.id}`, level: 'warn', kind: 'cardDue', card, due, days, link: 'debts' });
        }
    }
    for (const row of report.rows) {
        if (row.status === 'over') alerts.push({ key: `over-${row.categoryId}`, level: 'warn', kind: 'overBudget', row });
        else if (row.status === 'ahead') alerts.push({ key: `ahead-${row.categoryId}`, level: 'info', kind: 'aheadOfPace', row });
    }
    for (const clash of bigPurchaseClashes(doc, model.settings.bigPurchaseLimit)) {
        alerts.push({ key: `clash-${clash.month}`, level: 'warn', kind: 'bigClash', clash });
    }
    const soon = list(doc, 'planned')
        .filter((p) => p.status === 'planned' && p.month && p.month <= addMonths(monthOf(todayDate), 1))
        .sort((a, b) => a.month.localeCompare(b.month) || (a.priority ?? 9) - (b.priority ?? 9));
    for (const item of soon) alerts.push({ key: `planned-${item.id}`, level: 'info', kind: 'planned', item });

    const snapshots = list(doc, 'snapshots').sort((a, b) => b.date.localeCompare(a.date));
    const last = snapshots[0];
    const days = last ? daysBetween(last.date.slice(0, 10), todayDate) : null;
    if (!last || days >= model.settings.snapshotReminderDays) {
        alerts.push({ key: 'snapshot', level: 'info', kind: 'snapshot', days });
    }

    if (context.pastRates && context.incomeCurrency && context.incomeCurrency !== model.settings.spendingCurrency) {
        const from = context.incomeCurrency;
        const to = model.settings.spendingCurrency;
        const before = pairRate(from, to, { rates: context.pastRates });
        const now = pairRate(from, to, { rates: fx.rates });
        const change = before && now ? changeRatio(before, now) : null;
        if (change !== null && Math.abs(change) >= 0.03) {
            alerts.push({ key: 'fx', level: change < 0 ? 'warn' : 'info', kind: 'fxMove', from, to, change });
        }
    }
    if (totals.availableNow < 0) alerts.unshift({ key: 'negative', level: 'warn', kind: 'negative' });
    if (model.missing.length) alerts.unshift({ key: 'rates', level: 'warn', kind: 'missingRates', codes: model.missing });

    const order = { warn: 0, info: 1 };
    return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/** Interest and fees recorded on cards in a date range, in the display currency. */
export function cardFees(doc, fromDate, toDate, currency, fx, { categoryId = 'cat_fees', accountId } = {}) {
    return sumMinor(list(doc, 'tx')
        .filter((tx) => tx.type === 'expense' && tx.categoryId === categoryId && !tx.skipped && tx.date >= fromDate && tx.date <= toDate)
        .filter((tx) => !accountId || tx.accountId === accountId)
        .map((tx) => txAmountIn(tx, currency, doc, fx)));
}

/** Money in emergency-fund goal sources, in the display currency. */
export function goalProgress(goal, model) {
    const accounts = sumMinor((goal.accountIds || []).map((id) => model.accountsById[id]?.display || 0));
    const goldMg = sumMinor((goal.portionIds || []).map((id) => model.gold.holdings[id] || 0));
    const gold = goldMg ? goldValueMinor(goldMg, model.display, model.fx) || 0 : 0;
    const current = accounts + gold;
    const target = convertOrZero(goal.target, goal.currency, model.display, model.fx);
    return { current, target, ratio: target > 0 ? Math.min(1, current / target) : null };
}

export function daysUntil(todayDate, isoDate) {
    return isoDate ? daysBetween(todayDate, isoDate) : null;
}

export { debtAmount };
