/*
 * p-import.js — Brings data from the previous Prosperity app (its "v5" document) into this one. Pure (no DOM, no S):
 * pFromV5(doc, {latest, today}) returns the new notebook and a report of what came over.
 *
 * The two apps keep balances differently. The old one: the balance you last typed (an anchor) plus every transaction
 * after it. This one: an opening balance plus every entry. So each account's opening is set so that, after every
 * entry, its balance is exactly what the old app showed; a later typed balance becomes a balance fix, as it would be
 * here. The report compares both, account by account.
 */
"use strict";

const V5_KIND = { bank: "bank", ewallet: "wallet", cash: "cash", credit: "card", investment: "savings" };
/* the old app's built-in categories onto this one's (keeping the names you gave them); the rest become your own */
const V5_CAT = {
  cat_housing: "housing",
  cat_groceries: "groceries",
  cat_dining: "food",
  cat_transport: "transport",
  cat_health: "health",
  cat_subscriptions: "bills",
  cat_fees: "fees",
  cat_other: "other",
  cat_salary: "income",
  cat_income_other: "otherin",
};
const V5_ICON = {
  home: "home", cart: "shopping_cart", utensils: "restaurant", coffee: "local_cafe", sparkles: "spa",
  repeat: "subscriptions", bus: "directions_bus", shirt: "checkroom", headphones: "headphones", sofa: "chair",
  plane: "flight", heart: "favorite", percent: "payments", dots: "more_horiz", briefcase: "work", plus: "add_circle",
  gift: "redeem", book: "menu_book", game: "sports_esports", gym: "fitness_center", phone: "mobile",
};
const V5_COLOURS = ["#c98500", "#df5f2b", "#e0578c", "#00897b", "#2a78d6", "#b0671f", "#689f38", "#6a3fb5", "#c2185b", "#5f7389"];

/* ids here may only hold letters, digits and "-" */
const safeId = id => String(id).replace(/[^A-Za-z0-9-]/g, "-").slice(0, 64);

function v5Digits(cur) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: cur }).resolvedOptions().maximumFractionDigits;
  } catch (e) {
    return 2;
  }
}
/* minor units from one currency into another at a set of rates (units per USD), rounded half up like the old app */
function v5Convert(minor, from, to, rates) {
  if (!minor || from === to) return minor || 0;
  const a = rates && +rates[from],
    b = rates && +rates[to];
  if (!(a > 0) || !(b > 0)) return null;
  const major = minor / 10 ** v5Digits(from),
    out = (major * b) / a,
    f = 10 ** v5Digits(to);
  return Math.sign(out) * Math.round(Math.abs(out) * f + 1e-9);
}

function pFromV5(doc, o) {
  const live = name => Object.values((doc && doc[name]) || {}).filter(r => r && typeof r === "object" && !r.deleted);
  const setting = (k, d) => (live("settings").find(s => s.id === k) || {}).value ?? d;
  const latest = o.latest || {};
  const ratesOn = date => {
    const day = live("fxDays").find(f => f.id === date);
    return day ? Object.assign({}, latest, day.rates) : latest;
  };
  const report = { accounts: [], entries: 0, skipped: [], left: [], loans: [] };
  const accounts = live("accounts").sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byOld = new Map(accounts.map(a => [a.id, a]));
  const curOf = id => (byOld.get(id) || {}).currency;
  const toMajor = (minor, cur) => minor / 10 ** v5Digits(cur);
  const S = {
    v: 6,
    settings: {
      cur: setting("spendingCurrency", setting("displayCurrency", "EUR")),
      week: 1,
      clock: "24",
      lastCheck: o.today,
    },
    accounts: [],
    assets: [],
    cats: [],
    txns: [],
    loans: [],
    rules: [],
    skips: [],
    budgets: {},
    fxDays: {},
  };

  /* categories: the old ones mapped onto these, renamed to your names; built-ins you didn't have are hidden */
  const catId = {};
  let colour = 0;
  const custom = [];
  live("categories")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach(c => {
      if (V5_CAT[c.id]) {
        catId[c.id] = V5_CAT[c.id];
        custom.push({ id: V5_CAT[c.id], rename: c.name, kind: c.income ? "in" : "out" });
      } else {
        const id = safeId(c.id);
        catId[c.id] = id;
        custom.push({ id, name: c.name, i: V5_ICON[c.icon] || "category", c: V5_COLOURS[colour++ % V5_COLOURS.length], kind: c.income ? "in" : "out", fresh: true });
      }
    });
  S.pCats = custom; // applied onto the built-in list by pApplyImportedCats (p-app.js), which knows it
  const cat = id => catId[id] || "other";

  /* accounts: "other" kinds become things you own; the rest keep their currency and type */
  const accId = new Map();
  accounts.forEach(a => {
    const id = safeId(a.id);
    accId.set(a.id, id);
    if (a.kind === "other") return;
    const acc = { id, name: a.name || "Account", type: V5_KIND[a.kind] || "bank", currency: a.currency, opening: 0, archived: false };
    if (a.available === false && a.kind !== "credit") acc.avail = false;
    S.accounts.push(acc);
  });

  /* the old app's balance of each account: last typed balance + every transaction after it */
  const anchors = live("anchors");
  const latestAnchor = id => anchors.filter(x => x.accountId === id).sort((a, b) => a.setAt - b.setAt).pop() || null;
  const after = (t, an) => !an || (t.date !== an.date ? t.date > an.date : (t.createdAt || 0) > an.setAt);
  const counts = t => !t.skipped;
  const effects = t => {
    const out = [],
      rates = ratesOn(t.date),
      add = (id, minor, cur) => {
        const target = curOf(id);
        if (!target) return;
        const v = v5Convert(minor, cur, target, rates);
        out.push({ id, minor: v === null ? 0 : v, missing: v === null });
      };
    if (t.type === "expense" && t.accountId) add(t.accountId, -t.amount, t.currency);
    if (t.type === "income" && t.accountId) add(t.accountId, t.amount, t.currency);
    if (t.type === "transfer") {
      if (t.accountId) add(t.accountId, -t.amount, t.currency);
      if (t.toAccountId && curOf(t.toAccountId)) {
        if (t.toAmount !== undefined && t.toAmount !== null) out.push({ id: t.toAccountId, minor: t.toAmount });
        else add(t.toAccountId, t.amount, t.currency);
      }
    }
    return out;
  };
  const oldBal = {};
  accounts.forEach(a => {
    const an = latestAnchor(a.id);
    oldBal[a.id] = an ? an.amount : 0;
  });
  const txs = live("tx").sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  txs.filter(counts).forEach(t => effects(t).forEach(e => {
    if (e.id in oldBal && after(t, latestAnchor(e.id))) oldBal[e.id] += e.minor;
  }));

  /* entries: an amount in its account's currency (converted at that day's rate when the old one wasn't) */
  const ts = t => (t.createdAt > 0 ? t.createdAt : Date.parse(t.date + "T12:00:00")),
    inAcc = (t, id) => {
      const v = v5Convert(t.amount, t.currency, curOf(id), ratesOn(t.date));
      return toMajor(v === null ? t.amount : v, curOf(id));
    },
    settled = new Map(txs.filter(t => t.settlesTxId).map(t => [t.settlesTxId, t]));
  /* where money someone else paid for you "came in": the matching account in the debt's currency */
  const spendable = accounts.filter(a => a.kind !== "credit" && a.kind !== "investment" && a.kind !== "other" && a.available !== false);
  const homeFor = (cur, prefer) =>
    (prefer && byOld.get(prefer)) || spendable.find(a => a.currency === cur) || spendable[0] || accounts[0];

  txs.forEach(t => {
    if (t.settlesTxId && txs.some(x => x.id === t.settlesTxId)) return; // brought over with its debt
    if (t.skipped) {
      if (t.ruleId && t.ruleMonth) S.skips.push({ rule: safeId(t.ruleId), month: t.ruleMonth });
      return;
    }
    const base = { ts: ts(t), date: t.date, note: t.note || "" },
      link = t.ruleId && t.ruleMonth ? { rule: safeId(t.ruleId), rmonth: t.ruleMonth } : {},
      debt = t.debt && typeof t.debt === "object" ? t.debt : null;
    /* someone else paid, and you owe them (sure or maybe): a loan from them, spent at once */
    if (t.type === "expense" && !t.accountId && debt && debt.direction === "iOwe") {
      const pay = settled.get(t.id),
        home = homeFor(t.currency, pay && pay.accountId),
        lid = safeId(t.id) + "-loan",
        amt = inAcc({ ...t, amount: debt.amount ?? t.amount }, home.id);
      S.loans.push({ id: lid, ts: base.ts, kind: "borrow", person: debt.who || t.note || "Someone", account: accId.get(home.id), date: t.date, note: t.note || "", status: debt.status === "cancelled" ? "writeoff" : "open" });
      S.txns.push({ id: lid + "-in", ...base, type: "loan", amount: amt, account: accId.get(home.id), dir: "in", loan: lid, principal: true });
      S.txns.push({ id: safeId(t.id), ...base, ts: base.ts + 1, type: "expense", amount: inAcc(t, home.id), account: accId.get(home.id), cat: cat(t.categoryId), ...link });
      if (pay && pay.accountId) S.txns.push({ id: safeId(pay.id), ts: ts(pay), date: pay.date, note: pay.note || "", type: "loan", amount: inAcc(pay, pay.accountId), account: accId.get(pay.accountId), dir: "out", loan: lid });
      report.loans.push((debt.who || t.note || "Someone") + " · " + toMajor(debt.amount ?? t.amount, t.currency) + " " + t.currency);
      report.entries++;
      return;
    }
    /* you paid for someone who owes you: money lent, not spending */
    if (t.type === "expense" && t.accountId && debt && debt.direction === "owedToMe") {
      const pay = settled.get(t.id),
        lid = safeId(t.id) + "-lend";
      S.loans.push({ id: lid, ts: base.ts, kind: "lend", person: debt.who || t.note || "Someone", account: accId.get(t.accountId), date: t.date, note: t.note || "", status: debt.status === "cancelled" ? "writeoff" : "open" });
      S.txns.push({ id: lid + "-out", ...base, type: "loan", amount: inAcc(t, t.accountId), account: accId.get(t.accountId), dir: "out", loan: lid, principal: true });
      if (pay && pay.accountId) S.txns.push({ id: safeId(pay.id), ts: ts(pay), date: pay.date, note: pay.note || "", type: "loan", amount: inAcc(pay, pay.accountId), account: accId.get(pay.accountId), dir: "in", loan: lid });
      report.loans.push((debt.who || t.note || "Someone") + " owes you " + toMajor(t.amount, t.currency) + " " + t.currency);
      report.entries++;
      return;
    }
    if (t.type === "expense" || t.type === "income") {
      if (!t.accountId || !accId.has(t.accountId) || !S.accounts.some(a => a.id === accId.get(t.accountId))) {
        report.skipped.push(t.date + " " + (t.note || t.type) + ": paid by someone else, with no debt");
        return;
      }
      S.txns.push({ id: safeId(t.id), ...base, type: t.type, amount: inAcc(t, t.accountId), account: accId.get(t.accountId), cat: cat(t.categoryId), ...link });
      report.entries++;
      return;
    }
    if (t.type === "transfer" && t.accountId && t.toAccountId && accId.has(t.accountId) && accId.has(t.toAccountId)) {
      const x = { id: safeId(t.id), ...base, type: "transfer", amount: inAcc(t, t.accountId), account: accId.get(t.accountId), to: accId.get(t.toAccountId) };
      if (curOf(t.toAccountId) !== curOf(t.accountId) || (t.toAmount !== undefined && t.toAmount !== null && t.toAmount !== t.amount))
        x.toAmount = toMajor(t.toAmount !== undefined && t.toAmount !== null ? t.toAmount : v5Convert(t.amount, t.currency, curOf(t.toAccountId), ratesOn(t.date)) || 0, curOf(t.toAccountId));
      S.txns.push(x);
      report.entries++;
      return;
    }
    report.skipped.push(t.date + " " + (t.note || t.type) + ": a transfer missing one of its accounts");
  });

  /* each account's opening, and each later typed balance as a balance fix, so every balance comes out as before */
  const newAcc = new Map(S.accounts.map(a => [a.id, a]));
  const order = (x, y) => x.date.localeCompare(y.date) || x.ts - y.ts;
  const effect = (e, id) =>
    e.account === id
      ? e.type === "expense" ? -e.amount : e.type === "income" || e.type === "adjust" ? e.amount : e.type === "transfer" ? -e.amount : e.type === "loan" ? (e.dir === "in" ? e.amount : -e.amount) : 0
      : e.type === "transfer" && e.to === id ? (e.toAmount != null ? e.toAmount : e.amount) : 0;
  accounts.forEach(a => {
    const id = accId.get(a.id),
      acc = newAcc.get(id);
    if (!acc) return;
    const f = 10 ** v5Digits(a.currency),
      events = S.txns.filter(e => e.account === id || e.to === id).map(e => ({ e, date: e.date, ts: e.ts })),
      ancs = anchors.filter(x => x.accountId === a.id).sort((x, y) => x.date.localeCompare(y.date) || x.setAt - y.setAt);
    let opening = 0;
    if (ancs.length) {
      /* the first typed balance sets the opening: what it held before the entries up to then */
      const first = ancs[0],
        before = events.filter(x => x.date < first.date || (x.date === first.date && x.ts <= first.setAt)).reduce((q, x) => q + effect(x.e, id), 0);
      opening = Math.round((first.amount / f - before) * f) / f;
      /* every later one: the difference from what the entries gave, as a balance fix that day */
      ancs.slice(1).forEach(an => {
        const run = opening + events.filter(x => x.date < an.date || (x.date === an.date && x.ts <= an.setAt)).reduce((q, x) => q + effect(x.e, id), 0),
          diff = Math.round((an.amount / f - run) * f) / f;
        if (diff) {
          const fix = { id: safeId(an.id), ts: an.setAt, date: an.date, type: "adjust", amount: diff, account: id, note: "Balance set" };
          S.txns.push(fix);
          events.push({ e: fix, date: fix.date, ts: fix.ts });
        }
      });
    }
    acc.opening = opening;
    const now = Math.round((opening + events.reduce((q, x) => q + effect(x.e, id), 0)) * f);
    report.accounts.push({ name: a.name, currency: a.currency, before: oldBal[a.id] / f, after: now / f, same: now === oldBal[a.id] });
  });
  S.txns.sort(order);

  /* things you own that aren't accounts, at the old balance */
  accounts
    .filter(a => a.kind === "other")
    .forEach(a => S.assets.push({ id: safeId(a.id), name: a.name, value: oldBal[a.id] / 10 ** v5Digits(a.currency), currency: a.currency, i: "diamond", c: "#a646c9" }));

  /* gold: one item per part that holds any (grams as of now) */
  const mg = {};
  live("goldEvents")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0))
    .forEach(g => {
      const add = (p, n) => p && (mg[p] = (mg[p] || 0) + n);
      if (g.type === "buy" || g.type === "adjust") add(g.portionId, g.mg);
      if (g.type === "sell") add(g.portionId, -g.mg);
      if (g.type === "move") {
        add(g.portionId, -g.mg);
        add(g.toPortionId, g.mg);
      }
    });
  live("portions").forEach(p => {
    if (mg[p.id] > 0)
      S.assets.push({ id: safeId(p.id), name: p.name, kind: "gold", mg: mg[p.id], touch: !!p.available, value: 0, currency: S.settings.cur, i: "diamond", c: "#b8860b" });
  });

  /* recurring income and bills: an account they come into or go out of (salary with none: your first bank) */
  live("rules").forEach(r => {
    const acc =
      (r.accountId && accId.has(r.accountId) && newAcc.has(accId.get(r.accountId)) && accId.get(r.accountId)) ||
      (S.accounts.find(a => a.currency === r.currency && a.type === "bank") || S.accounts.find(a => a.type !== "card") || {}).id ||
      null;
    S.rules.push({
      id: safeId(r.id),
      type: r.type,
      name: r.name,
      amount: toMajor(r.amount, r.currency),
      currency: r.currency,
      account: acc,
      cat: cat(r.categoryId),
      day: r.dayOfMonth || 1,
      start: r.startMonth || null,
      end: r.endMonth || null,
    });
  });

  live("budgets").forEach(b => {
    if (b.amount > 0) S.budgets[cat(b.categoryId)] = { amount: toMajor(b.amount, b.currency), currency: b.currency };
  });
  live("fxDays").forEach(d => {
    const r = {};
    Object.entries(d.rates || {}).forEach(([k, v]) => {
      if (+v > 0) r[k] = +v;
    });
    S.fxDays[d.id] = r;
  });

  const n = name => live(name).length;
  if (n("planned")) report.left.push(n("planned") + " planned purchase" + (n("planned") === 1 ? "" : "s"));
  if (n("goals")) report.left.push(n("goals") + " goal" + (n("goals") === 1 ? "" : "s"));
  if (n("snapshots")) report.left.push(n("snapshots") + " snapshot" + (n("snapshots") === 1 ? "" : "s"));
  const terms = accounts.filter(a => a.monthlyRate).length;
  if (terms) report.left.push("card interest settings (" + terms + ")");
  report.counts = { accounts: S.accounts.length, entries: report.entries, rules: S.rules.length, budgets: Object.keys(S.budgets).length, gold: S.assets.filter(x => x.kind === "gold").length };
  return { state: S, report };
}
