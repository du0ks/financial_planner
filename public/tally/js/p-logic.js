/*
 * p-logic.js — Prosperity's additions, the pure part (no DOM, no S): exchange rates and conversion, gold prices,
 * card interest and payoff, "Everything I own" and the chain down to net worth and available now, and recurring
 * income and bills. Loaded in the page like every other script, and by plain Node for the tests.
 */
"use strict";

/* ---------- currencies and rates ---------- */

/* rates are units of each currency per 1 USD, as published (XAU: troy ounces per USD) */
const TROY_OUNCE_G = 31.1034768;
const pDigits = cur => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: cur }).resolvedOptions().maximumFractionDigits;
  } catch (e) {
    return 2;
  }
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
  if (r === null) return null;
  const f = 10 ** pDigits(to);
  return Math.round(amount * r * f) / f;
}
/* one gram of gold at spot, in `cur`; null without rates */
function pGram(cur, rates) {
  if (!rates || !(rates.XAU > 0) || !(rates[cur] > 0)) return null;
  return (1 / rates.XAU / TROY_OUNCE_G) * rates[cur];
}
const pGoldValue = (mg, cur, rates) => {
  const g = pGram(cur, rates);
  if (g === null) return null;
  const f = 10 ** pDigits(cur);
  return Math.round(((g * (mg || 0)) / 1000) * f) / f;
};

/* ---------- card interest (ported from Prosperity's src/lib/cards.js) ----------
   Turkey (BDDK, as Turkish banks' worked examples show): when the whole statement isn't paid, interest runs on the
   UNPAID remainder, plus KKDF 15% + BSMV 15% on that interest; paying less than the minimum adds late interest
   (about 0.30 points more) on the missing part. Generic: no taxes; whether the bank charges the remainder or the
   whole statement is the card's choice. Money here is in minor units (kuruş, cents) so every step rounds the same. */
const P_PRESETS = {
  turkey: { tax: 30, minPct: 20, minFloor: 0, base: "remainder", late: 0.3 },
  generic: { tax: 0, minPct: 5, minFloor: 0, base: "statement", late: 0 },
};
function pTerms(card) {
  const t = (card && card.terms) || {},
    preset = P_PRESETS[t.preset] ? t.preset : card && card.currency === "TRY" ? "turkey" : "generic",
    p = P_PRESETS[preset],
    num = (v, d) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : d);
  return {
    preset,
    rate: num(t.rate, null),
    tax: num(t.tax, p.tax),
    minPct: num(t.minPct, p.minPct),
    minFloor: num(t.minFloor, p.minFloor),
    base: t.base === "statement" || t.base === "remainder" ? t.base : p.base,
    late: num(t.late, p.late),
    stmtDay: num(t.stmtDay, null),
    dueDay: num(t.dueDay, null),
  };
}
/* real cost per month as a fraction: 3.75% with 30% tax → 0.04875 */
const pMonthly = (rate, tax) => ((rate || 0) / 100) * (1 + (tax || 0) / 100);
const pYearly = m => (1 + m) ** 12 - 1;
const scale = (minor, frac) => Math.round(minor * frac);
/* the least the bank takes: a share of the statement, at least the fixed minimum (minor units), at most all of it */
function pMinimum(statement, t, floorMinor) {
  if (statement <= 0) return 0;
  const m = Math.max(scale(statement, t.minPct / 100), floorMinor || 0);
  return m <= 0 ? statement : Math.min(statement, m);
}
/* interest (taxes included) on the next statement after paying `paid` against `statement` */
function pCycleInterest(statement, paid, t, floorMinor) {
  if (statement <= 0 || paid >= statement || !t.rate) return 0;
  const unpaid = statement - Math.max(0, paid);
  let i = scale(t.base === "statement" ? statement : unpaid, pMonthly(t.rate, t.tax));
  const short = pMinimum(statement, t, floorMinor) - Math.max(0, paid);
  if (short > 0 && t.late > 0) i += scale(short, pMonthly(t.late, t.tax));
  return i;
}
/* month by month from a statement of `balance` (minor units): pay, then interest lands on the next statement.
   strategy: {type: "full" | "minimum" | "fixed", amount} */
function pSimulate(balance, t, strategy, floorMinor, maxMonths = 600) {
  if (!(balance > 0)) return { months: 0, interest: 0, paidOff: true, belowMin: false };
  let st = balance,
    interest = 0,
    belowMin = false;
  for (let m = 1; m <= maxMonths; m++) {
    const min = pMinimum(st, t, floorMinor);
    let pay = st;
    if (strategy.type === "minimum") pay = min;
    if (strategy.type === "fixed") pay = Math.min(st, strategy.amount || 0);
    if (pay < min) belowMin = true;
    const c = pCycleInterest(st, pay, t, floorMinor);
    interest += c;
    const next = st - pay + c;
    if (next <= 0) return { months: m, interest, paidOff: true, belowMin };
    if (next >= st) return { months: null, interest: null, paidOff: false, belowMin };
    st = next;
  }
  return { months: null, interest, paidOff: false, belowMin };
}
/* several cards from one monthly amount, all in one currency: each gets its minimum, the rest goes to the highest
   real rate first. cards: [{id, balance (minor), t, floor (minor)}] */
function pOrder(cards) {
  const r = c => (c.t.rate ? pMonthly(c.t.rate, c.t.tax) : 0);
  return cards.filter(c => c.balance > 0).sort((a, b) => r(b) - r(a) || b.balance - a.balance);
}
function pSimulateAll(cards, monthly, maxMonths = 600) {
  const order = pOrder(cards),
    bal = {},
    clearedIn = {};
  order.forEach(c => (bal[c.id] = c.balance));
  let interest = 0,
    short = false;
  for (let m = 1; m <= maxMonths; m++) {
    const open = order.filter(c => bal[c.id] > 0);
    if (!open.length) return { months: m - 1, interest, order, clearedIn, short, paidOff: true };
    const pay = {};
    let left = monthly;
    open.forEach(c => {
      const min = pMinimum(bal[c.id], c.t, c.floor);
      pay[c.id] = Math.min(min, left);
      if (pay[c.id] < min) short = true;
      left -= pay[c.id];
    });
    open.forEach(c => {
      if (left <= 0) return;
      const extra = Math.min(left, bal[c.id] - pay[c.id]);
      pay[c.id] += extra;
      left -= extra;
    });
    const before = open.reduce((q, c) => q + bal[c.id], 0);
    open.forEach(c => {
      const ch = pCycleInterest(bal[c.id], pay[c.id], c.t, c.floor);
      interest += ch;
      bal[c.id] = bal[c.id] - pay[c.id] + ch;
      if (bal[c.id] <= 0 && !clearedIn[c.id]) clearedIn[c.id] = m;
    });
    if (open.reduce((q, c) => q + bal[c.id], 0) >= before)
      return { months: null, interest: null, order, clearedIn, short, paidOff: false };
  }
  return { months: null, interest, order, clearedIn, short, paidOff: false };
}
/* minor units ⇄ amounts */
const pToMinor = (n, cur) => Math.round((n || 0) * 10 ** pDigits(cur));
const pFromMinor = (m, cur) => (m || 0) / 10 ** pDigits(cur);

/* ---------- Everything I own, and the chain ----------
   in: { cur, rates, accounts (active, with .bal, .avail), assets, loans: [{kind, left, cur}], bills (in cur) }
   Groups, each item with its own amount and currency and its value in `cur`:
     spendable        accounts that count as money you can use, and cards paid past zero
     goldTouchable    gold you'd sell if needed
     goldUntouchable  gold you keep
     investments      accounts that don't count as available (savings, a fund)
     other            other assets, and money lent that is still owed to you
   chain: total − card debt − loans you owe = net worth
          − untouchable gold − investments − other − bills before next income = available now */
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
  const g = { spendable: [], goldTouchable: [], goldUntouchable: [], investments: [], other: [] };
  let cardDebt = 0,
    owe = 0;
  o.accounts.forEach(a => {
    if (a.type === "card") {
      if (a.bal > 0) g.spendable.push({ id: a.id, name: a.name, amount: a.bal, currency: a.currency, value: conv(a.bal, a.currency), acc: a });
      else if (a.bal < 0) cardDebt += conv(-a.bal, a.currency);
      return;
    }
    (a.avail ? g.spendable : g.investments).push({ id: a.id, name: a.name, amount: a.bal, currency: a.currency, value: conv(a.bal, a.currency), acc: a });
  });
  o.assets.forEach(x => {
    if (x.kind === "gold") {
      const v = pGoldValue(x.mg, o.cur, o.rates);
      if (v === null && x.mg) missing.add("XAU");
      (x.touch ? g.goldTouchable : g.goldUntouchable).push({ id: x.id, name: x.name, mg: x.mg, value: v || 0, asset: x });
    } else g.other.push({ id: x.id, name: x.name, amount: x.value, currency: x.currency, value: conv(x.value, x.currency), asset: x });
  });
  o.loans.forEach(l => {
    if (l.kind === "lend") g.other.push({ id: l.id, name: l.name, amount: l.left, currency: l.cur, value: conv(l.left, l.cur), loan: l });
    else owe += conv(l.left, l.cur);
  });
  const f = 10 ** pDigits(o.cur),
    r = n => Math.round(n * f) / f,
    groups = Object.keys(g).map(key => ({ key, items: g[key], total: r(g[key].reduce((q, i) => q + i.value, 0)) })),
    by = Object.fromEntries(groups.map(x => [x.key, x.total])),
    total = r(groups.reduce((q, x) => q + x.total, 0));
  cardDebt = r(cardDebt);
  owe = r(owe);
  const bills = r(o.bills || 0),
    netWorth = r(total - cardDebt - owe),
    availableNow = r(netWorth - by.goldUntouchable - by.investments - by.other - bills);
  const chain = [
    { key: "assets", value: total, total: true },
    { key: "cards", value: -cardDebt },
    ...(owe ? [{ key: "owe", value: -owe }] : []),
    { key: "netWorth", value: netWorth, total: true },
    { key: "goldUntouchable", value: -by.goldUntouchable },
    { key: "investments", value: -by.investments },
    ...(by.other ? [{ key: "other", value: -by.other }] : []),
    { key: "bills", value: -bills },
    { key: "availableNow", value: availableNow, total: true },
  ];
  return { groups, total, cardDebt, owe, bills, netWorth, availableNow, chain, missing: [...missing] };
}

/* ---------- recurring income and bills ----------
   rule {id, type: "expense" | "income", name, amount, currency, account, cat, day, start: "YYYY-MM", end} — each month's
   occurrence is done once an entry carries {rule: id, rmonth: month}, or skipped in skips [{rule, month}] */
const pMonthOf = d => d.slice(0, 7);
const pAddMonths = (m, n) => {
  const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};
const pDaysIn = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
const pRuleActive = (r, m) => (!r.start || r.start <= m) && (!r.end || m <= r.end);
const pOccDate = (r, m) => m + "-" + String(Math.min(r.day || 1, pDaysIn(m))).padStart(2, "0");
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
/* what is waiting: income that should have arrived, and bills still to pay before the next income (30 days when
   there's none). Looks back one month so an unconfirmed bill from last month isn't forgotten. */
function pPending(rules, txns, skips, today) {
  const payday = pNextIncome(rules, txns, skips, today);
  const until = payday || addDaysISO(today, 30);
  const m = pMonthOf(today),
    occ = [pAddMonths(m, -1), m, pAddMonths(m, 1), pAddMonths(m, 2)]
      .flatMap(x => pOccurrences(rules, txns, skips, x))
      .filter(o => !o.done && o.date >= (o.rule.start || "0000") + "-01");
  return {
    payday,
    income: occ.filter(o => o.rule.type === "income" && o.date <= today),
    bills: occ.filter(o => o.rule.type === "expense" && o.date <= until),
  };
}
function addDaysISO(d, n) {
  const x = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
