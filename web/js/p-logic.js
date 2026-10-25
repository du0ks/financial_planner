/*
 * p-logic.js — the pure money maths (no DOM, no S): exchange rates and conversion, gold prices,
 * "Everything I own" and the chain down to net worth and available now, recurring income and bills, and budgets.
 * Loaded in the page like every other script, and by plain Node for the tests (prosperity-tests/).
 */
"use strict";

/* ---------- currencies and rates ----------
   Rates are units of each currency per 1 USD, as published (XAU: troy ounces of gold per USD). */
const TROY_OUNCE_G = 31.1034768;
const pDigits = cur => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: cur }).resolvedOptions().maximumFractionDigits;
  } catch (e) {
    return 2;
  }
};
const pRound = (n, cur) => {
  const f = 10 ** pDigits(cur);
  return Math.round(n * f + (n >= 0 ? 1e-9 : -1e-9)) / f;
};
/* how many `to` one `from` buys; null when a rate is missing */
function pRate(from, to, rates) {
  if (from === to) return 1;
  if (!rates || !(rates[from] > 0) || !(rates[to] > 0)) return null;
  return rates[to] / rates[from];
}
/* an amount converted and rounded to the target currency's own decimals; null when a rate is missing */
function pConv(amount, from, to, rates) {
  if (!amount) return 0;
  const r = pRate(from, to, rates);
  return r === null ? null : pRound(amount * r, to);
}
/* the rates of one day: that day's saved rates where there are any, today's for the rest */
const pRatesOn = (latest, fxDays, date) => (fxDays && fxDays[date] ? Object.assign({}, latest || {}, fxDays[date]) : latest);
/* one gram of gold at spot, in `cur`; null without rates */
function pGram(cur, rates) {
  if (!rates || !(rates.XAU > 0) || !(rates[cur] > 0)) return null;
  return (1 / rates.XAU / TROY_OUNCE_G) * rates[cur];
}
const pGoldValue = (mg, cur, rates) => {
  const g = pGram(cur, rates);
  return g === null ? null : pRound((g * (mg || 0)) / 1000, cur);
};

/* ---------- Everything I own, and the chain ----------
   in: { cur, rates, accounts (active, each with .bal and .avail), assets, loans: [{kind, left, cur}], bills (in cur) }
   Groups — every item once, with its own amount and its value in `cur`:
     spendable    accounts that count as money you can use, and a card paid past zero
     gold         gold, touchable or not (split for the chain)
     investments  accounts that don't count as money you can use (savings, a fund)
     other        other things you own, and money you lent that is still owed to you
   Chain (each step one subtraction):
     everything I own − card debt − loans I owe                                   = net worth
     net worth − untouchable gold − investments − other − bills before next income = available now */
function pWorth(o) {
  const missing = new Set(),
    conv = (v, c) => {
      const x = pConv(v, c, o.cur, o.rates);
      if (x === null) {
        missing.add(c);
        return 0;
      }
      return x;
    };
  const g = { spendable: [], gold: [], investments: [], other: [] };
  let cardDebt = 0,
    owe = 0;
  o.accounts.forEach(a => {
    const item = { id: a.id, name: a.name, amount: a.bal, currency: a.currency, acc: a };
    if (a.type === "card") {
      if (a.bal > 0) g.spendable.push(Object.assign(item, { value: conv(a.bal, a.currency) }));
      else if (a.bal < 0) cardDebt += conv(-a.bal, a.currency);
      return;
    }
    item.value = conv(a.bal, a.currency);
    (a.avail ? g.spendable : g.investments).push(item);
  });
  o.assets.forEach(x => {
    if (x.kind === "gold") {
      const v = pGoldValue(x.mg, o.cur, o.rates);
      if (v === null && x.mg) missing.add("XAU");
      g.gold.push({ id: x.id, name: x.name, mg: x.mg, touch: !!x.touch, value: v || 0, asset: x });
    } else g.other.push({ id: x.id, name: x.name, amount: x.value, currency: x.currency, value: conv(x.value, x.currency), asset: x });
  });
  o.loans.forEach(l => {
    if (l.kind === "lend") g.other.push({ id: l.id, name: l.name, amount: l.left, currency: l.cur, value: conv(l.left, l.cur), loan: l });
    else owe += conv(l.left, l.cur);
  });
  const r = n => pRound(n, o.cur),
    sum = list => r(list.reduce((q, i) => q + i.value, 0)),
    groups = Object.keys(g).map(key => ({ key, items: g[key], total: sum(g[key]) })),
    by = Object.fromEntries(groups.map(x => [x.key, x.total])),
    goldTouchable = sum(g.gold.filter(i => i.touch)),
    goldUntouchable = r(by.gold - goldTouchable),
    total = r(groups.reduce((q, x) => q + x.total, 0));
  cardDebt = r(cardDebt);
  owe = r(owe);
  const bills = r(o.bills || 0),
    netWorth = r(total - cardDebt - owe),
    availableNow = r(netWorth - goldUntouchable - by.investments - by.other - bills);
  const chain = [
    { key: "assets", value: total, total: true },
    { key: "cards", value: -cardDebt },
    ...(owe ? [{ key: "owe", value: -owe }] : []),
    { key: "netWorth", value: netWorth, total: true },
    { key: "goldUntouchable", value: -goldUntouchable },
    { key: "investments", value: -by.investments },
    ...(by.other ? [{ key: "other", value: -by.other }] : []),
    { key: "bills", value: -bills },
    { key: "availableNow", value: availableNow, total: true },
  ];
  return { groups, goldTouchable, goldUntouchable, total, cardDebt, owe, bills, netWorth, availableNow, chain, missing: [...missing] };
}

/* ---------- recurring income and bills ----------
   rule {id, type: "expense" | "income", name, amount, currency, account, cat, day, start: "YYYY-MM", end} — a month's
   occurrence is done once an entry carries {rule: id, rmonth: month}, or it was skipped (skips [{rule, month}]) */
const pMonthOf = d => d.slice(0, 7);
const pAddMonths = (m, n) => {
  const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};
const pDaysIn = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
const pRuleActive = (r, m) => (!r.start || r.start <= m) && (!r.end || m <= r.end);
const pOccDate = (r, m) => m + "-" + String(Math.min(r.day || 1, pDaysIn(m))).padStart(2, "0");
function pAddDays(d, n) {
  const x = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
/* every occurrence of the rules in month m: {rule, month, date, done} */
function pOccurrences(rules, txns, skips, m) {
  return rules
    .filter(r => pRuleActive(r, m))
    .map(r => ({
      rule: r,
      month: m,
      date: pOccDate(r, m),
      done: txns.some(t => t.rule === r.id && t.rmonth === m) || skips.some(s => s.rule === r.id && s.month === m),
    }));
}
/* the next income after `today` (this month or the next two), or null */
function pNextIncome(rules, txns, skips, today) {
  const m = pMonthOf(today);
  for (let i = 0; i < 3; i++) {
    const next = pOccurrences(rules.filter(r => r.type === "income"), txns, skips, pAddMonths(m, i))
      .filter(o => o.date > today && !o.done)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) return next.date;
  }
  return null;
}
/* what is waiting: income that should have arrived, and bills still to pay up to the next income (the next 30 days
   when there's none). Looks back a month, so last month's unconfirmed bill isn't forgotten. */
function pPending(rules, txns, skips, today) {
  const payday = pNextIncome(rules, txns, skips, today),
    until = payday || pAddDays(today, 30),
    m = pMonthOf(today),
    occ = [pAddMonths(m, -1), m, pAddMonths(m, 1), pAddMonths(m, 2)]
      .flatMap(x => pOccurrences(rules, txns, skips, x))
      .filter(o => !o.done && o.month >= (o.rule.start || "0000-00"));
  return {
    payday,
    income: occ.filter(o => o.rule.type === "income" && o.date <= today),
    bills: occ.filter(o => o.rule.type === "expense" && o.date <= until),
  };
}

/* ---------- budgets ----------
   One monthly budget per spending category, in any currency (budgets: {catId: {amount, currency}}).
   in: { cur, month, today, cats: [{id}], spend: [{date, cat, amount, currency}] (that month's spending),
         budgets, coming: [{cat, amount, currency}] (that month's bills not confirmed yet), billCats (categories with a
         recurring bill), latest, fxDays, income (that month's expected income in cur, or null) }
   Spending converts at the rate of its own day; budgets and bills to come at today's.
   A row's status: none (no budget) · over (spent more than the budget) · tight (bills still to come take it over)
   · ahead (this month, spending faster than the days passing; not for bill categories, paid all at once) · ok */
function pBudget(o) {
  const r = n => pRound(n, o.cur),
    now = conv => (conv === null ? 0 : conv),
    days = pDaysIn(o.month),
    thisMonth = pMonthOf(o.today) === o.month,
    elapsed = thisMonth ? +o.today.slice(8, 10) : o.month < pMonthOf(o.today) ? days : 0,
    daysLeft = thisMonth ? days - elapsed + 1 : o.month > pMonthOf(o.today) ? days : 0;
  let missing = false;
  const spent = {},
    coming = {};
  o.spend.forEach(s => {
    const v = pConv(s.amount, s.currency, o.cur, pRatesOn(o.latest, o.fxDays, s.date));
    if (v === null) missing = true;
    spent[s.cat] = (spent[s.cat] || 0) + now(v);
  });
  (o.coming || []).forEach(c => {
    const v = pConv(c.amount, c.currency, o.cur, o.latest);
    if (v === null) missing = true;
    coming[c.cat] = (coming[c.cat] || 0) + now(v);
  });
  const ids = o.cats.map(c => c.id).concat(Object.keys(spent).filter(id => !o.cats.some(c => c.id === id)));
  const rows = ids.map(cat => {
    const b = o.budgets[cat],
      bv = b ? pConv(b.amount, b.currency, o.cur, o.latest) : null;
    if (b && bv === null) missing = true;
    const budget = b ? r(now(bv)) : null,
      sp = r(spent[cat] || 0),
      co = r(coming[cat] || 0);
    let status = "none";
    if (budget !== null) {
      const pace = (budget * elapsed) / days;
      if (sp > budget) status = "over";
      else if (sp + co > budget) status = "tight";
      else if (thisMonth && !o.billCats.includes(cat) && sp > pace) status = "ahead";
      else status = "ok";
    }
    return { cat, budget, spent: sp, coming: co, left: budget === null ? null : r(budget - sp - co), status };
  });
  const budgeted = rows.filter(x => x.budget !== null),
    total = r(budgeted.reduce((q, x) => q + x.budget, 0)),
    spentIn = r(budgeted.reduce((q, x) => q + x.spent, 0)),
    comingIn = r(budgeted.reduce((q, x) => q + x.coming, 0)),
    unbudgeted = rows.filter(x => x.budget === null && (x.spent > 0 || x.coming > 0)),
    left = r(total - spentIn - comingIn);
  return {
    rows,
    total,
    spent: r(rows.reduce((q, x) => q + x.spent, 0)),
    spentIn,
    coming: comingIn,
    left,
    unbudgeted: r(unbudgeted.reduce((q, x) => q + x.spent + x.coming, 0)),
    unbudgetedCount: unbudgeted.length,
    noBudget: rows.filter(x => x.budget === null).length,
    daysLeft,
    perDay: daysLeft > 0 && left > 0 ? r(left / daysLeft) : 0,
    unassigned: o.income === null || o.income === undefined ? null : r(o.income - total),
    missing,
  };
}
