/*
 * p-app.js — Money across currencies and what it adds up to: one everyday currency at live rates, the Budget tab,
 * "Everything I own" with the chain to net worth and available now, gold in grams, and recurring income and bills.
 * Some screens are wrapped or replaced here (render() calls them by name). The maths lives in p-logic.js; rates in
 * p-fx.js.
 */
"use strict";

/* ---------- data ---------- */

/* migrate() rebuilds every record from the fields state.js knows; this puts back the ones added here, checked */
function pMigrate(o, s) {
  const byId = list => new Map((Array.isArray(list) ? list : []).filter(x => x && typeof x.id === "string").map(x => [x.id, x])),
    num = v => (typeof v === "number" && isFinite(v) && v >= 0 ? v : undefined),
    isCur = v => typeof v === "string" && /^[A-Z]{3}$/.test(v),
    isMonth = v => typeof v === "string" && /^\d{4}-\d{2}$/.test(v),
    isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const oa = byId(o.accounts);
  s.accounts.forEach(a => {
    const x = oa.get(a.id) || {};
    if (typeof x.avail === "boolean") a.avail = x.avail;
  });
  const ox = byId(o.assets);
  s.assets.forEach(a => {
    const x = ox.get(a.id) || {};
    if (x.kind === "gold") {
      a.kind = "gold";
      a.mg = Math.round(num(x.mg) || 0);
      a.touch = x.touch === true;
    }
  });
  const ot = byId(o.txns);
  s.txns.forEach(t => {
    const x = ot.get(t.id);
    if (x && typeof x.rule === "string" && isMonth(x.rmonth) && (t.type === "expense" || t.type === "income")) {
      t.rule = x.rule;
      t.rmonth = x.rmonth;
    }
  });
  s.rules = (Array.isArray(o.rules) ? o.rules : [])
    .filter(r => r && typeof r.id === "string" && (r.type === "expense" || r.type === "income"))
    .map(r => ({
      id: r.id,
      type: r.type,
      name: String(r.name || "").slice(0, 40) || "Recurring",
      amount: num(r.amount) || 0,
      currency: isCur(r.currency) ? r.currency : s.settings.cur || "USD",
      account: s.accounts.some(a => a.id === r.account) ? r.account : null,
      cat: typeof r.cat === "string" ? r.cat : null,
      day: Math.min(31, Math.max(1, Math.round(num(r.day) || 1))),
      start: isMonth(r.start) ? r.start : null,
      end: isMonth(r.end) ? r.end : null,
    }));
  s.skips = (Array.isArray(o.skips) ? o.skips : [])
    .filter(k => k && typeof k.rule === "string" && isMonth(k.month))
    .map(k => ({ rule: k.rule, month: k.month }));
  s.budgets = {};
  if (o.budgets && typeof o.budgets === "object")
    Object.entries(o.budgets).forEach(([cat, b]) => {
      if (b && num(b.amount) > 0 && isCur(b.currency)) s.budgets[cat] = { amount: b.amount, currency: b.currency };
    });
  s.fxDays = {};
  if (o.fxDays && typeof o.fxDays === "object")
    Object.entries(o.fxDays).forEach(([d, r]) => {
      if (!isDay(d) || !r || typeof r !== "object") return;
      const day = {};
      Object.entries(r).forEach(([c, v]) => {
        if (/^[A-Z]{3}$/.test(c) && num(v) > 0) day[c] = v;
      });
      s.fxDays[d] = day;
    });
}
const pRules = () => S.rules || (S.rules = []);
const pSkips = () => S.skips || (S.skips = []);
const pBudgets = () => S.budgets || (S.budgets = {});
/* savings don't count as money you can use unless you say so; every other account does unless you say not */
const pAvail = a => (typeof a.avail === "boolean" ? a.avail : a.type !== "savings");
const pCur = () => S.settings.cur || (activeAccounts()[0] || {}).currency || "USD";
const pMonthNow = () => today().slice(0, 7);
const approx = (n, cur) => "≈ " + money(n, cur);
/* the currency an entry is in: its account's */
const pTxCur = t => (acc(t.account) || {}).currency;
/* an entry's amount in the everyday currency, at the rate of its own day (0 while that rate is unknown) */
function pIn(t) {
  const c = pTxCur(t),
    cur = pCur();
  if (!c || c === cur) return t.amount;
  const v = pConv(t.amount, c, cur, pRatesOn(pRates(), S.fxDays, t.date));
  return v === null ? 0 : v;
}

/* The everyday currency changed: budgets set in the old one would now move with the rate every day, so offer to
   turn them into the new currency once, at today's rate, rounded to whole units. */
function pEverydayChanged(was, now) {
  const old = Object.entries(pBudgets()).filter(([, b]) => b.currency !== now);
  if (!old.length) return;
  if (!pRates()) return snack("Budgets stay in " + was + " until rates load");
  askDialog(
    "Budgets in " + now + "?",
    old.length + (old.length === 1 ? " budget is" : " budgets are") + " in another currency. Convert " + (old.length === 1 ? "it" : "them") +
      " to " + now + " at today's rate, rounded?",
    "Convert",
    () => {
      old.forEach(([cat, b]) => {
        const v = pConv(b.amount, b.currency, now, pRates());
        if (v !== null) pBudgets()[cat] = { amount: Math.max(1, Math.round(v)), currency: now };
      });
      commit();
      snack("Budgets are in " + now);
    },
    { cancel: "Keep as they are" }
  );
}

/* Entries written for an earlier day get that day's published rates (once), so they count at what the money was
   worth then. Runs after saves and when rates arrive; a day that can't be fetched is tried again next time. */
const pTried = new Set();
let pFilling = false;
async function pFillRates() {
  if (pFilling || !pRates()) return;
  pFilling = true;
  try {
    const t = today(),
      since = addDays(t, -400),
      codes = [...new Set([pCur(), "USD"].concat(S.accounts.map(a => a.currency)))],
      days = [...new Set(S.txns.map(x => x.date))].filter(d => d < t && d >= since && !(S.fxDays || {})[d] && !pTried.has(d)).slice(0, 20);
    let got = 0;
    for (const d of days) {
      pTried.add(d);
      const r = await pFetchDay(d);
      if (!r) continue;
      const day = {};
      codes.forEach(c => {
        if (r[c]) day[c] = r[c];
      });
      S.fxDays = S.fxDays || {};
      S.fxDays[d] = day;
      got++;
    }
    if (got) {
      save();
      if (!$("#sheet").innerHTML) render();
    }
  } finally {
    pFilling = false;
  }
}

/* Each day's rates are kept with the data the first time something is saved that day, so this month's spending,
   added up in your main currency, doesn't change when rates move tomorrow. Only the currencies in use. */
function pFreezeToday() {
  const rates = pRates();
  if (!rates) return;
  const d = today(),
    codes = new Set([pCur(), "USD"].concat(S.accounts.map(a => a.currency), pRules().map(r => r.currency)));
  S.fxDays = S.fxDays || {};
  const day = S.fxDays[d] || {};
  let changed = false;
  codes.forEach(c => {
    if (!day[c] && rates[c]) {
      day[c] = rates[c];
      changed = true;
    }
  });
  if (changed) S.fxDays[d] = day;
}
const prosperityCommit = commit;
commit = function () {
  pFreezeToday();
  prosperityCommit();
  setTimeout(pFillRates, 0);
};

/* everything the screens show, worked out once per render */
let PM = null;
const prosperityRender = render;
render = function () {
  PM = null;
  prosperityRender();
};
function pModel() {
  if (PM) return PM;
  const cur = pCur(),
    rates = pRates(),
    b = balances(),
    accounts = activeAccounts().map(a => Object.assign({}, a, { bal: b[a.id], avail: pAvail(a) })),
    loans = S.loans
      .map(l => ({ l, i: loanInfo(l) }))
      .filter(x => x.i.open)
      .map(x => ({ id: x.l.id, kind: x.l.kind, name: loanWho(x.l), left: x.i.left, cur: x.i.cur, loan: x.l })),
    pend = pPending(pRules(), S.txns, pSkips(), today());
  let billsMissing = false;
  const bills = pend.bills.reduce((q, o) => {
    const v = pConv(o.rule.amount, o.rule.currency, cur, rates);
    if (v === null) billsMissing = true;
    return q + (v || 0);
  }, 0);
  const w = pWorth({ cur, rates, accounts, assets: S.assets, loans, bills });
  if (billsMissing) w.missing.push("rates");
  return (PM = { cur, rates, b, accounts, loans, pend, w });
}
const ratesLine = () =>
  PFX.date ? "Rates of " + dayLabel(PFX.date) + (PFX.goldAt ? " · gold live" : "") : "Rates not loaded yet: other currencies count as 0";
/* a section title with its total and a small + beside it */
const pSecHead = (title, total, act, v, label) =>
  '<div class="sec p-sec"><span>' +
  esc(title) +
  '</span><span class="p-sec-r">' +
  (total === null ? "" : "<b>" + esc(total) + "</b>") +
  (act
    ? '<button class="p-plus" data-act="' + act + '"' + (v ? ' data-v="' + esc(v) + '"' : "") + ' aria-label="' + esc(label) + '">' + ic("add") + "</button>"
    : "") +
  "</span></div>";
const pEmpty = text => '<p class="hint" style="margin:0 4px">' + esc(text) + "</p>";

/* ---------- tabs: Home, Budget, Assets, Liabilities ---------- */

/* the tabs drawScreen() (screens.js) shows */
const P_TABS = [
  ["home", "Home", "home"],
  ["budget", "Budget", "budget"],
  ["assets", "Assets", "wallet"],
  ["liabs", "Liabilities", "card"],
];
P.budget = "M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z";

/* ---------- Home ---------- */

const prosperityHomeView = homeView;
homeView = function () {
  const h = prosperityHomeView();
  if (!activeAccounts().length)
    return h.replace(
      "Add first account</button>",
      'Add first account</button><div class="gap"></div><button class="btn tonal" data-act="p-demo">Try it with sample data</button>'
    );
  return h.replace("Lend</button></div>", "Lend</button></div>" + pWaiting(pModel()));
};
/* recurring income and bills waiting to be confirmed */
function pWaiting(m) {
  const list = m.pend.income.concat(m.pend.bills).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return "";
  const t = today();
  return (
    '<div class="sec">To confirm</div><div class="list">' +
    list
      .map(o => {
        const r = o.rule,
          d = daysBetween(t, o.date),
          when = d === 0 ? "today" : d > 0 ? "in " + d + (d === 1 ? " day" : " days") : -d + (d === -1 ? " day late" : " days late"),
          conv = r.currency !== m.cur ? pConv(r.amount, r.currency, m.cur, m.rates) : null;
        return (
          '<button class="tx" data-act="p-confirm" data-v="' +
          esc(r.id + "|" + o.month) +
          '">' +
          emblem(cat(r.cat), "em") +
          '<span class="mid"><div class="d" dir="auto">' +
          esc(r.name) +
          '</div><div class="s">' +
          esc(dayLabel(o.date) + " · " + when) +
          '</div></span><span class="a' +
          (r.type === "income" ? " got" : "") +
          '">' +
          esc((r.type === "income" ? "+" : "") + money(r.amount, r.currency)) +
          (conv !== null ? "<small>" + esc(approx(conv, m.cur)) + "</small>" : "") +
          "</span></button>"
        );
      })
      .join("") +
    "</div>"
  );
}

/* ---------- the chain ---------- */

const P_STEP = {
  assets: "Everything I own",
  cards: "Card debt",
  owe: "Loans I owe",
  netWorth: "Net worth",
  goldUntouchable: "Untouchable gold",
  investments: "Savings & reserves",
  other: "Other things & money owed to me",
  bills: "Bills before next income",
  availableNow: "Available now",
};
const P_STEP_TAB = { cards: "liabs", owe: "liabs", goldUntouchable: "assets", investments: "assets", other: "assets" };
function chainHTML(m) {
  return m.w.chain
    .map(s => {
      const label = s.key === "bills" && m.pend.payday ? P_STEP.bills + " (" + dayLabel(m.pend.payday) + ")" : P_STEP[s.key],
        tab = P_STEP_TAB[s.key] && V.screen !== P_STEP_TAB[s.key] ? P_STEP_TAB[s.key] : null,
        tag = tab ? "button" : "div";
      return (
        "<" +
        tag +
        (tab ? ' data-act="p-tab" data-v="' + tab + '"' : "") +
        ' class="p-line' +
        (s.total ? " tot" : "") +
        (s.key === "availableNow" ? " end" : "") +
        '"><span>' +
        (s.total ? "= " : "− ") +
        esc(label) +
        "</span><b>" +
        esc(money(s.total ? s.value : Math.abs(s.value), m.cur)) +
        "</b></" +
        tag +
        ">"
      );
    })
    .join("");
}
function pChainSheet() {
  const m = pModel();
  openSheet(
    "How it adds up",
    '<div class="card p-chain">' +
      chainHTML(m) +
      '</div><p class="hint">' +
      esc(ratesLine()) +
      ". Bills are the recurring ones still to pay before your next income.</p>"
  );
}

/* ---------- Budget ---------- */

/* one month's budget report (p-logic.js pBudget) from the notebook */
function pBudgetFor(month) {
  const cur = pCur(),
    rates = pRates(),
    thisOrLater = month >= pMonthNow(),
    rules = pRules(),
    occ = pOccurrences(rules, S.txns, pSkips(), month).filter(o => o.month >= (o.rule.start || "0000-00")),
    inMonth = S.txns.filter(t => t.date.slice(0, 7) === month && pTxCur(t));
  const income =
    inMonth.filter(t => t.type === "income").reduce((q, t) => q + (pConv(t.amount, pTxCur(t), cur, pRatesOn(rates, S.fxDays, t.date)) || 0), 0) +
    (thisOrLater
      ? occ.filter(o => !o.done && o.rule.type === "income").reduce((q, o) => q + (pConv(o.rule.amount, o.rule.currency, cur, rates) || 0), 0)
      : 0);
  return pBudget({
    cur,
    month,
    today: today(),
    cats: outCats(),
    spend: inMonth.filter(isSpend).map(t => ({ date: t.date, cat: t.cat, amount: t.amount, currency: pTxCur(t) })),
    budgets: pBudgets(),
    coming: thisOrLater ? occ.filter(o => !o.done && o.rule.type === "expense").map(o => ({ cat: o.rule.cat, amount: o.rule.amount, currency: o.rule.currency })) : [],
    billCats: rules.filter(r => r.type === "expense").map(r => r.cat),
    latest: rates,
    fxDays: S.fxDays,
    income: income > 0 ? income : null,
  });
}
const P_STATUS = { ok: "", ahead: "spending fast", tight: "bills take it over", over: "over budget" };
function budgetView() {
  const cur = pCur(),
    month = V.bm || pMonthNow(),
    b = pBudgetFor(month),
    current = month === pMonthNow(),
    past = month < pMonthNow();
  let h =
    '<header class="appbar"><h1>Budget</h1>' +
    topIcons() +
    "</header>" +
    '<div class="p-month"><button class="icon" data-act="p-bm" data-v="-1" aria-label="Previous month">' +
    ic("left") +
    "</button><span>" +
    esc(monthLabel(month, true)) +
    '</span><button class="icon" data-act="p-bm" data-v="1" aria-label="Next month"' +
    (month >= pAddMonths(pMonthNow(), 1) ? " disabled" : "") +
    ">" +
    ic("right") +
    "</button></div>";
  const over = b.left < 0,
    used = b.total > 0 ? Math.min(100, ((b.spentIn + b.coming) / b.total) * 100) : 0,
    lines = [];
  lines.push("Spent " + money(b.spentIn, cur) + " of " + money(b.total, cur));
  if (b.coming) lines.push(money(b.coming, cur) + " in bills still to come");
  if (current && b.perDay) lines.push("About " + money(b.perDay, cur) + " a day for the " + b.daysLeft + (b.daysLeft === 1 ? " day" : " days") + " left");
  if (b.unbudgeted) lines.push(money(b.unbudgeted, cur) + " spent without a budget");
  /* a balance fixed downwards is money that went somewhere no entry says: it is in no budget */
  const fixes = -S.txns.filter(t => t.type === "adjust" && t.amount < 0 && t.date.slice(0, 7) === month).reduce((q, t) => q + pIn(t), 0);
  if (fixes > 0) lines.push(money(fixes, cur) + " went in balance fixes, outside any budget");
  if (b.unassigned !== null && b.total)
    lines.push(
      b.unassigned >= 0
        ? "Income " + money(b.total + b.unassigned, cur) + " · " + money(b.unassigned, cur) + " left after all budgets"
        : "Budgets are " + money(-b.unassigned, cur) + " more than this month's income"
    );
  const avail = pModel().w.availableNow;
  if (current && b.left > 0 && avail < b.left) lines.push("Only " + money(Math.max(0, avail), cur) + " is available now: less than the budget left");
  h +=
    '<div class="sumcard' +
    (over ? " owe" : "") +
    '"><div class="t">' +
    (b.total ? (over ? "Over budget by" : past ? "Left unspent" : "Left to spend") : "No budgets yet") +
    '</div><div class="big">' +
    esc(b.total ? money(Math.abs(b.left), cur) : money(b.spent, cur)) +
    "</div>" +
    (b.total
      ? '<div class="bar p-bar' + (over ? " over" : "") + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(used) + '"><span style="width:' + used.toFixed(1) + '%"></span></div>' +
        lines.map(l => '<div class="t small">' + esc(l) + "</div>").join("")
      : '<div class="t small">' + esc((b.spent ? "spent this month. " : "") + "Give each category a monthly budget below.") + "</div>") +
    (b.missing ? '<div class="t small p-warn">' + esc(ratesLine()) + "</div>" : "") +
    "</div>";
  const rows = b.rows.slice().sort((x, y) => (x.budget === null) - (y.budget === null));
  h +=
    pSecHead("Categories", b.noBudget ? b.noBudget + " without a budget" : null) +
    '<div class="list">' +
    rows.map(r => pBudgetRow(r, cur)).join("") +
    "</div>" +
    '<p class="hint" style="margin:10px 4px 0">' +
    esc(
      (current ? "The line on each bar is where today falls in the month. " : "") +
        "Spending in other currencies counts at the rate of its own day; budgets and bills at today's."
    ) +
    "</p>";
  return h;
}
function pBudgetRow(r, cur) {
  const k = cat(r.cat),
    pct = r.budget ? Math.min(100, ((r.spent + r.coming) / r.budget) * 100) : 0,
    spentPct = r.budget ? Math.min(100, (r.spent / r.budget) * 100) : 0,
    month = V.bm || pMonthNow(),
    mark = month === pMonthNow() ? (+today().slice(8, 10) / pDaysIn(month)) * 100 : null;
  const s = n => money(n, cur, true), // short: ₺1,561 — a row has little room
    sub =
      r.budget === null
        ? r.spent
          ? "Spent " + s(r.spent) + " · no budget"
          : "No budget yet"
        : s(r.spent) + " of " + s(r.budget) + (r.coming ? " · " + s(r.coming) + " to come" : "") + (P_STATUS[r.status] ? " · " + P_STATUS[r.status] : "");
  return (
    '<button class="tx p-brow ' +
    r.status +
    '" data-act="p-budget" data-v="' +
    esc(r.cat) +
    '">' +
    emblem(k, "em") +
    '<span class="mid"><div class="d" dir="auto">' +
    esc(k.name) +
    '</div><div class="s">' +
    esc(sub) +
    "</div>" +
    (r.budget !== null
      ? '<div class="bar p-bar ' +
        r.status +
        '"><span class="sp" style="width:' +
        spentPct.toFixed(1) +
        '%"></span><span class="co" style="width:' +
        (pct - spentPct).toFixed(1) +
        '%"></span>' +
        (mark !== null && r.status !== "none" ? '<i style="left:' + mark.toFixed(1) + '%"></i>' : "") +
        "</div>"
      : "") +
    '</span><span class="a' +
    (r.left !== null && r.left < 0 ? " p-debt" : r.budget === null ? " muted" : "") +
    '">' +
    (r.budget === null ? "Set" : esc(s(Math.abs(r.left))) + "<small>" + (r.left < 0 ? "over" : "left") + "</small>") +
    "</span></button>"
  );
}
function pBudgetSheet(catId) {
  const cur = pCur(),
    k = cat(catId),
    b0 = pBudgets()[catId],
    month = V.bm || pMonthNow(),
    rep = pBudgetFor(month).rows.find(r => r.cat === catId) || { spent: 0, coming: 0 },
    shown = b0 ? (b0.currency === cur ? b0.amount : pConv(b0.amount, b0.currency, cur, pRates()) || b0.amount) : "",
    list = S.txns.filter(t => isSpend(t) && t.cat === catId && t.date.slice(0, 7) === month).sort(byNewest);
  F = { kind: "pbudget", cat: catId };
  openSheet(
    k.name,
    amtField("p-bamt", cur, shown === "" ? "" : String(shown), { label: "Budget every month" }) +
      '<p class="hint">' +
      esc(
        monthLabel(month, true) +
          ": spent " +
          money(rep.spent, cur) +
          (rep.coming ? ", " + money(rep.coming, cur) + " in bills to come" : "") +
          ". The same budget repeats every month."
      ) +
      '</p><div class="gap"></div><button class="btn" data-act="p-budget-save">' +
      ic("check") +
      "Save</button>" +
      (b0 ? '<div class="gap"></div><button class="btn text" data-act="p-budget-del">Remove budget</button>' : "") +
      (list.length ? '<div class="sec">' + esc(monthLabel(month, true)) + '</div><div class="list">' + list.map(txLine).join("") + "</div>" : "")
  );
}
function pBudgetSave() {
  const raw = ($("#p-bamt") || {}).value || "",
    v = raw.trim() ? evalAmt(raw) : 0;
  if (v === null || v < 0) return snack("That isn't a number");
  const id = F.cat,
    name = cat(id).name;
  closeSheet();
  if (v > 0) pBudgets()[id] = { amount: v, currency: pCur() };
  else delete pBudgets()[id];
  commit();
  snack(v > 0 ? name + ": " + money(v, pCur()) + " a month" : name + ": no budget");
}

/* ---------- Assets: everything I own ---------- */

function pAccRow(a, it, cur) {
  return (
    '<button class="tx' +
    (FX.row === a.id ? " flash" : "") +
    '" data-act="acc-open" data-v="' +
    a.id +
    '">' +
    emblem(accEmb(a), "em") +
    '<span class="mid"><div class="d" dir="auto">' +
    esc(a.name) +
    '</div><div class="s">' +
    esc(typeName(a.type) + " · " + a.currency) +
    '</div></span><span class="a' +
    (it.amount < 0 ? " p-debt" : "") +
    '">' +
    esc(money(it.amount, a.currency)) +
    (a.currency !== cur ? "<small>" + esc(approx(it.value, cur)) + "</small>" : "") +
    "</span></button>"
  );
}
function pItemRow(it, cur) {
  if (it.acc) return pAccRow(acc(it.id), it, cur);
  if (it.loan) return loanRow(it.loan.loan);
  if (it.asset && it.asset.kind === "gold")
    return (
      '<button class="tx" data-act="p-gold" data-v="' +
      it.id +
      '">' +
      emblem({ i: "diamond", c: "#b8860b" }, "em") +
      '<span class="mid"><div class="d" dir="auto">' +
      esc(it.name) +
      '</div><div class="s">' +
      esc(pGrams(it.mg)) +
      '</div></span><span class="a">' +
      esc(money(it.value, cur)) +
      "</span></button>"
    );
  const x = it.asset;
  return (
    '<button class="tx" data-act="asset-edit" data-v="' +
    x.id +
    '">' +
    emblem(x, "em") +
    '<span class="mid"><div class="d" dir="auto">' +
    esc(x.name) +
    '</div></span><span class="a">' +
    esc(money(x.value, x.currency)) +
    (x.currency !== cur ? "<small>" + esc(approx(it.value, cur)) + "</small>" : "") +
    "</span></button>"
  );
}
const pGrams = mg => (mg / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + " g";
assetsView = function () {
  const m = pModel(),
    cur = m.cur,
    g = Object.fromEntries(m.w.groups.map(x => [x.key, x])),
    list = items => '<div class="list">' + items.map(it => pItemRow(it, cur)).join("") + "</div>";
  let left =
    '<div class="sumcard"><div class="t">Net worth</div><div class="big">' +
    esc(money(m.w.netWorth, cur)) +
    '</div><div class="t small">Everything I own ' +
    esc(money(m.w.total, cur)) +
    ' · <button class="p-curchip" data-act="pick-maincur" aria-label="Main currency: ' +
    esc(cur) +
    '">' +
    esc(cur) +
    " ⇄</button></div>" +
    (m.w.missing.length ? '<div class="t small p-warn">' + esc(ratesLine()) + "</div>" : "") +
    "</div>";
  left +=
    pSecHead("Spendable money", money(g.spendable.total, cur), "acc-form", "", "Add account") +
    (g.spendable.items.length ? list(g.spendable.items) : pEmpty("Accounts, wallets and cash you can use."));
  /* gold: one place, touchable above untouchable */
  const touch = g.gold.items.filter(i => i.touch),
    keep = g.gold.items.filter(i => !i.touch),
    sub = (label, total, items) =>
      '<div class="p-sub"><span>' + esc(label) + "</span><b>" + esc(money(total, cur)) + "</b></div>" +
      (items.length ? items.map(it => pItemRow(it, cur)).join("") : '<div class="p-none">None</div>');
  left +=
    pSecHead("Gold", money(g.gold.total, cur), "p-gold", "new", "Add gold") +
    (g.gold.items.length
      ? '<div class="list">' + sub("Touchable", m.w.goldTouchable, touch) + sub("Untouchable", m.w.goldUntouchable, keep) + "</div>"
      : pEmpty("Gold in grams, valued at today's spot price. Touchable gold counts as money you can use."));
  let right =
    pSecHead("Savings & reserves", money(g.investments.total, cur), "p-addsav", "", "Add a savings account or reserve") +
    (g.investments.items.length
      ? list(g.investments.items)
      : pEmpty("Money you keep and don't spend from: a fund, savings, a currency you hold. Turn off “Counts as money I can use” on any account to put it here."));
  right +=
    pSecHead("Other things & money owed to me", money(g.other.total, cur), "p-addother", "", "Add something you own or money you lent") +
    (g.other.items.length ? list(g.other.items) : pEmpty("Things you own, like a laptop, and money you lent."));
  const arch = S.accounts.filter(a => a.archived);
  if (arch.length) {
    right += '<button class="btn text" data-act="toggle-arch">' + (V.showArchived ? "Hide" : "Show") + " archived (" + arch.length + ")</button>";
    if (V.showArchived) right += '<div class="list">' + arch.map(a => accRow(a, m.b)).join("") + "</div>";
  }
  right += '<div class="sec">How it adds up</div><div class="card p-chain">' + chainHTML(m) + "</div>";
  return tabBar("Assets") + panes(left, right);
};

/* ---------- Liabilities: cards and loans ---------- */

liabsView = function () {
  const m = pModel(),
    cur = m.cur,
    cards = m.accounts.filter(a => a.type === "card"),
    mine = S.loans.filter(l => l.kind === "borrow"),
    open = mine.filter(l => loanInfo(l).open),
    done = mine.filter(l => !loanInfo(l).open);
  let h =
    '<div class="sumcard owe"><div class="t">You owe</div><div class="big">' +
    esc(money(m.w.cardDebt + m.w.owe, cur)) +
    '</div><div class="t small">' +
    esc("Cards " + money(m.w.cardDebt, cur) + " · loans " + money(m.w.owe, cur)) +
    "</div></div>";
  h +=
    pSecHead("Credit cards", money(m.w.cardDebt, cur), "p-addcard", "", "Add a credit card") +
    (cards.length
      ? '<div class="list">' +
        cards
          .map(a => {
            const owed = Math.max(0, -a.bal);
            const shown = owed || a.bal;
            return pAccRow(a, { amount: shown, value: pConv(shown, a.currency, cur, m.rates) || 0 }, cur).replace(
              esc(typeName(a.type) + " · " + a.currency),
              esc(owed ? "Owed · " + a.currency : a.bal > 0 ? "Paid past zero · " + a.currency : "Nothing owed · " + a.currency)
            ).replace('<span class="a">', owed ? '<span class="a p-debt">' : '<span class="a">');
          })
          .join("") +
        "</div>"
      : pEmpty("Your credit cards and what each one owes."));
  let right =
    pSecHead("Loans", money(m.w.owe, cur), "loan-new", "borrow", "Record a loan") +
    (open.length ? '<div class="list">' + open.map(loanRow).join("") + "</div>" : pEmpty("Money you borrowed shows here until it's paid back."));
  if (done.length) {
    right += '<button class="btn text" data-act="toggle-cleared">' + (V.showCleared ? "Hide" : "Show") + " paid back (" + done.length + ")</button>";
    if (V.showCleared) right += '<div class="list">' + done.map(loanRow).join("") + "</div>";
  }
  return tabBar("Liabilities") + panes(h, right);
};

/* ---------- gold ---------- */

function pGoldForm(v) {
  const x = v && v !== "new" ? S.assets.find(a => a.id === v) : null;
  F = { kind: "pgold", id: x ? x.id : null, touch: x ? x.touch : true };
  const h =
    '<label class="field"><span>Name</span><input id="p-gname" maxlength="30" value="' +
    esc(x ? x.name : "") +
    '" placeholder="e.g. Bracelet, coins, quarter gold"></label>' +
    '<label class="field"><span>Grams</span><input id="p-grams" inputmode="decimal" autocomplete="off" value="' +
    esc(x ? String(x.mg / 1000) : "") +
    '" placeholder="0"></label>' +
    '<div class="seg">' +
    [
      ["yes", "Touchable"],
      ["no", "Untouchable"],
    ]
      .map(([k, l]) => '<button data-act="p-touch" data-v="' + k + '" aria-pressed="' + ((k === "yes") === F.touch) + '">' + l + "</button>")
      .join("") +
    '</div><p class="hint">Touchable gold counts as money you can use; untouchable gold counts only in net worth.</p>' +
    '<p class="hint" id="p-gprev"></p><div class="gap"></div><button class="btn" data-act="p-gold-save">' +
    (x ? "Save" : "Add gold") +
    "</button>" +
    (x ? '<div class="gap"></div><button class="btn danger" data-act="p-gold-del">Delete</button>' : "");
  openSheet(x ? x.name : "Gold", h);
  pGoldPreview();
}
function pGoldPreview() {
  const el = $("#p-gprev");
  if (!el) return;
  const cur = pCur(),
    g = pGram(cur, pRates()),
    grams = evalAmt(($("#p-grams") || {}).value || "") || 0;
  el.textContent = g === null ? "No gold price yet (offline)." : money(g, cur) + " a gram at spot" + (grams ? " · " + money(g * grams, cur) : "");
}
function pGoldSave() {
  const name = $("#p-gname").value.trim() || "Gold",
    g = evalAmt($("#p-grams").value || "");
  if (!(g > 0)) return snack("Enter the grams");
  const data = { name, kind: "gold", mg: Math.round(g * 1000), touch: F.touch, i: "diamond", e: "", c: "#b8860b", value: 0, currency: pCur() };
  const id = F.id;
  closeSheet();
  withUndo(id ? "Gold saved" : name + " added", () => {
    if (id) Object.assign(S.assets.find(x => x.id === id), data);
    else S.assets.push(Object.assign({ id: newId() }, data));
  });
}

/* ---------- recurring income and bills ---------- */

function pRuleForm(id, type) {
  const r = id ? pRules().find(x => x.id === id) : null;
  type = r ? r.type : type || "expense";
  const first = activeAccounts().find(a => a.type !== "card" || type === "expense") || activeAccounts()[0];
  if (!first) return snack("Add an account first");
  F = {
    kind: "prule",
    id: r ? r.id : null,
    type,
    cur: r ? r.currency : first.currency,
    account: r ? r.account : first.id,
    cat: r ? r.cat : type === "income" ? "income" : "bills",
  };
  openSheet(r ? r.name : type === "income" ? "Recurring income" : "Recurring bill", pRuleBody(r));
}
function pRuleBody(r) {
  const cats = F.type === "income" ? inCats() : outCats(),
    accs = activeAccounts().filter(a => F.type === "expense" || a.type !== "card");
  return (
    '<div class="seg">' +
    [
      ["expense", "Bill"],
      ["income", "Income"],
    ]
      .map(([k, l]) => '<button data-act="p-rtype" data-v="' + k + '" aria-pressed="' + (F.type === k) + '">' + l + "</button>")
      .join("") +
    "</div>" +
    '<label class="field"><span>Name</span><input id="p-rname" maxlength="40" value="' +
    esc(r ? r.name : "") +
    '" placeholder="' +
    (F.type === "income" ? "e.g. Salary" : "e.g. Rent, AI subscription") +
    '"></label>' +
    '<div class="row"><div class="field"><span>Currency</span><button class="fieldbtn" id="p-rcur" data-act="p-rcur"><span>' +
    esc(F.cur) +
    "</span>" +
    ic("down") +
    '</button></div><label class="field"><span>Amount</span><input id="p-ramt" inputmode="decimal" autocomplete="off" value="' +
    esc(r ? String(r.amount) : "") +
    '" placeholder="0"></label><label class="field"><span>Day</span><input id="p-rday" inputmode="numeric" value="' +
    esc(r ? String(r.day) : "1") +
    '"></label></div>' +
    '<div class="lbl">' +
    (F.type === "income" ? "Arrives in" : "Paid from") +
    '</div><div class="chips">' +
    accs
      .map(a => '<button class="chip" data-act="p-racc" data-v="' + a.id + '" aria-pressed="' + (F.account === a.id) + '">' + emblem(accEmb(a), "ci") + esc(a.name) + "</button>")
      .join("") +
    '</div><div class="lbl">Category</div><div class="chips">' +
    cats
      .map(k => '<button class="chip" data-act="p-rcat" data-v="' + k.id + '" aria-pressed="' + (F.cat === k.id) + '">' + emblem(k, "ci") + esc(k.name) + "</button>")
      .join("") +
    '</div><p class="hint">Each month it waits on Home until you confirm it, with the amount that really moved. Another currency is converted into the account’s at that day’s rate.</p><div class="gap"></div><button class="btn" data-act="p-rule-save">' +
    ic("check") +
    "Save</button>" +
    (r ? '<div class="gap"></div><button class="btn danger" data-act="p-rule-del">Delete</button>' : "")
  );
}
function pRuleSave() {
  const name = $("#p-rname").value.trim(),
    amount = evalAmt($("#p-ramt").value || ""),
    day = Math.round(+$("#p-rday").value);
  if (!name) return snack("Give it a name");
  if (!(amount > 0)) return snack("Enter an amount");
  if (!(day >= 1 && day <= 31)) return snack("Day goes from 1 to 31");
  if (!acc(F.account)) return snack("Pick an account");
  const data = { type: F.type, name, amount, currency: F.cur, account: F.account, cat: F.cat, day },
    was = F.id;
  if (was) Object.assign(pRules().find(x => x.id === was), data);
  else pRules().push(Object.assign({ id: newId(), start: pMonthNow(), end: null }, data));
  closeSheet();
  commit();
  snack(was ? "Saved" : name + " added");
}
/* confirming one month: the usual entry sheet, prefilled, in the account's currency */
function pConfirm(v) {
  const [rid, month] = v.split("|"),
    r = pRules().find(x => x.id === rid);
  if (!r) return;
  const a = acc(r.account) && !acc(r.account).archived ? acc(r.account) : activeAccounts()[0];
  if (!a) return;
  const occ = pOccurrences([r], S.txns, pSkips(), month)[0],
    conv = r.currency === a.currency ? r.amount : pConv(r.amount, r.currency, a.currency, pRates()),
    date = occ.date <= today() ? occ.date : today();
  txSheet(null, r.type, r.cat, {
    amount: conv === null ? r.amount : conv,
    account: a.id,
    cur: a.currency,
    note: r.name + (r.currency !== a.currency ? " (" + money(r.amount, r.currency) + ")" : ""),
    date,
    link: { rule: r.id, rmonth: month },
  });
  const p = $("#sheet .p");
  if (p)
    p.insertAdjacentHTML(
      "beforeend",
      (r.currency !== a.currency ? '<p class="hint">' + esc(money(r.amount, r.currency) + " at today's rate. Change it to what was really charged.") + "</p>" : "") +
        '<button class="btn text" data-act="p-skip" data-v="' +
        esc(v) +
        '">Skip this month</button>'
    );
}
function pSkip(v) {
  const [rule, month] = v.split("|");
  closeSheet();
  pSkips().push({ rule, month });
  commit();
  snack("Skipped this month");
}

/* ---------- account sheet: "counts as money I can use", and Pay card ---------- */

const prosperityAccOpen = accOpen;
accOpen = function (id) {
  prosperityAccOpen(id);
  const a = acc(id),
    p = $("#sheet .p");
  if (!a || !p) return;
  const extra =
    a.type === "card"
      ? (balances()[id] < 0 ? '<div class="gap"></div><button class="btn" data-act="p-pay" data-v="' + a.id + '">' + ic("swap") + "Pay card</button>" : "")
      : '<div class="list" style="margin-top:12px"><div class="setrow"><span class="mid"><div>Counts as money I can use</div><div class="s">Off for money you keep: savings, a fund, a currency you hold</div></span><button class="sw" role="switch" data-act="p-avail" data-v="' +
        a.id +
        '" aria-checked="' +
        pAvail(a) +
        '" aria-label="Counts as money I can use"></button></div></div>';
  p.insertAdjacentHTML("beforeend", extra);
};

/* ---------- Settings ---------- */

const prosperitySettingsView = settingsView;
settingsView = function () {
  const h = prosperitySettingsView(),
    i = h.indexOf("</header>") + "</header>".length,
    rules = pRules().slice().sort((a, b) => (a.type === b.type ? a.day - b.day : a.type === "income" ? -1 : 1));
  const mine =
    pSecHead("Recurring income & bills", null, "p-rule-new", "expense", "Add recurring income or bill") +
    (rules.length
      ? '<div class="list">' +
        rules
          .map(
            r =>
              '<button class="tx" data-act="p-rule" data-v="' +
              r.id +
              '">' +
              emblem(cat(r.cat), "em") +
              '<span class="mid"><div class="d" dir="auto">' +
              esc(r.name) +
              '</div><div class="s">' +
              esc((r.type === "income" ? "Income" : "Bill") + " · every month on the " + r.day + (acc(r.account) ? " · " + acc(r.account).name : "")) +
              '</div></span><span class="a' +
              (r.type === "income" ? " got" : "") +
              '">' +
              esc(money(r.amount, r.currency)) +
              "</span></button>"
          )
          .join("") +
        "</div>"
      : pEmpty("Salary, rent, subscriptions: each month they wait on Home until you confirm them.")) +
    '<div class="sec">Exchange rates</div><div class="list"><div class="setrow"><span class="mid"><div>' +
    esc(ratesLine()) +
    '</div><div class="s">Totals are in your main currency (' +
    esc(pCur()) +
    ')</div></span><button class="btn tonal" data-act="p-fx-refresh">Refresh</button></div></div>' +
    '<div class="sec">Try it</div><div class="list"><div class="setrow"><span class="mid"><div>Sample data</div><div class="s">Replaces everything here with an example</div></span><button class="btn tonal" data-act="p-demo">Load</button></div></div>';
  return h.slice(0, i) + mine + h.slice(i);
};

/* ---------- sample data ---------- */

function pDemo() {
  const go = () => {
    S = migrate(pDemoState());
    V.screen = "home";
    V.cur = null;
    V.bm = null;
    commit();
    snack("Sample data loaded");
  };
  if (S.accounts.length) askDialog("Replace everything?", "Your accounts and entries here are replaced by the sample.", "Replace", go, { danger: true });
  else go();
}
function pDemoState() {
  /* someone paid in TRY who lives on CZK: salary lands at Ziraat, goes to Wise as CZK, and is spent
     there; EUR is kept aside; gold in two parts. Everyday currency CZK, so budgets are in CZK. */
  const t = today(),
    d = n => addDays(t, n),
    m = pMonthNow(),
    prev = pAddMonths(m, -1),
    day = (mo, n) => mo + "-" + String(n).padStart(2, "0"),
    past = n => n < +t.slice(8, 10), // this month's day n is already behind us
    ts = n => Date.now() - n * 1000,
    account = (id, name, type, currency, opening, extra) => Object.assign({ id, name, type, currency, opening, archived: false }, extra || {});
  const txns = [],
    add = x => txns.push(Object.assign({ ts: ts(500 - txns.length) }, x));
  /* each month: salary, the transfer to Wise, dorm, AI subscription on the card */
  [prev, m].forEach((mo, i) => {
    const k = i ? "c" : "p";
    if (!i || past(1)) add({ id: k + "sal", date: day(mo, 1), type: "income", amount: 45000, account: "ziraat", cat: "income", note: "Salary", rule: "salary", rmonth: mo });
    if (!i || past(2)) add({ id: k + "tr", date: day(mo, 2), type: "transfer", amount: 30000, account: "ziraat", to: "wisecz", toAmount: 13020, note: "To Wise" });
    if (!i || past(20)) add({ id: k + "dorm", date: day(mo, 20), type: "expense", amount: 6300, account: "wisecz", cat: "housing", note: "Dorm", rule: "dorm", rmonth: mo });
    if (!i || past(28)) add({ id: k + "ai", date: day(mo, 28), type: "expense", amount: 990.08, account: "zcard", cat: "bills", note: "AI subscription ($20.00)", rule: "ai", rmonth: mo });
  });
  [
    [-9, 389.9, "wisecz", "groceries", "Albert"],
    [-6, 612.4, "wisecz", "groceries", "Lidl"],
    [-5, 185, "czkcash", "food", "Canteen"],
    [-4, 250, "wisecz", "health", "Pharmacy"],
    [-3, 452.3, "wisecz", "groceries", "Kaufland"],
    [-2, 165, "czkcash", "food", "Canteen"],
    [-1, 1240, "zcard", "shopping", "Headphones case"],
    [0, 49, "czkcash", "transport", "Tram"],
    [0, 129.9, "wisecz", "groceries", "Lidl"],
  ].forEach(([n, amount, account, cat, note], i) => add({ id: "e" + i, date: d(n), type: "expense", amount, account, cat, note }));
  add({ id: "l1", date: d(-12), type: "loan", amount: 3400, account: "wisecz", dir: "in", loan: "fridge", principal: true });
  add({ id: "l2", date: d(-6), type: "loan", amount: 2000, account: "ziraat", dir: "out", loan: "lent", principal: true, due: d(20) });
  const budget = amount => ({ amount, currency: "CZK" });
  return {
    v: 6,
    settings: { cur: "CZK", week: 1, clock: "24", lastCheck: t },
    accounts: [
      account("ziraat", "Ziraat", "bank", "TRY", 32450.75),
      account("zcard", "Ziraat card", "card", "TRY", -12380.4),
      account("icard", "İş card", "card", "TRY", -4250),
      account("wisecz", "Wise CZK", "wallet", "CZK", 1820.5),
      account("czkcash", "CZK cash", "cash", "CZK", 1250),
      account("wiseeu", "Wise EUR", "wallet", "EUR", 1310, { avail: false }),
      account("eurcash", "EUR cash", "cash", "EUR", 400, { avail: false }),
      account("fund", "Mutual fund", "savings", "TRY", 25000),
    ],
    assets: [
      { id: "g1", name: "Bracelet", kind: "gold", mg: 5000, touch: true, value: 0, currency: "TRY", i: "diamond", c: "#b8860b" },
      { id: "g2", name: "Quarter coins", kind: "gold", mg: 20000, touch: false, value: 0, currency: "TRY", i: "diamond", c: "#b8860b" },
    ],
    rules: [
      { id: "salary", type: "income", name: "Salary", amount: 45000, currency: "TRY", account: "ziraat", cat: "income", day: 1, start: prev },
      { id: "dorm", type: "expense", name: "Dorm", amount: 6300, currency: "CZK", account: "wisecz", cat: "housing", day: 20, start: prev },
      { id: "ai", type: "expense", name: "AI subscription", amount: 20, currency: "USD", account: "zcard", cat: "bills", day: 28, start: prev },
    ],
    budgets: {
      groceries: budget(4000),
      food: budget(1500),
      transport: budget(600),
      housing: budget(6500),
      bills: budget(500),
      shopping: budget(1000),
      fun: budget(800),
    },
    txns,
    loans: [
      { id: "fridge", ts: ts(80), kind: "borrow", person: "Roommate", account: "wisecz", date: d(-12), note: "Fridge", status: "open" },
      { id: "lent", ts: ts(70), kind: "lend", person: "Friend", account: "ziraat", date: d(-6), note: "", status: "open" },
    ],
  };
}

/* ---------- clicks and typing ---------- */

const pTab = v => {
  closeSheet();
  V.screen = v;
  FLIP = v;
  render();
  scrollTo(0, 0);
};
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]");
  if (!el || !el.dataset.act.startsWith("p-")) return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case "p-chain":
      pChainSheet();
      break;
    case "p-tab":
      pTab(v);
      break;
    case "p-demo":
      pDemo();
      break;
    case "p-fx-refresh":
      snack("Getting rates…");
      PFX.at = 0;
      pRefreshFx().then(() => {
        render();
        snack(PFX.date ? "Rates of " + dayLabel(PFX.date) : "Couldn't get rates (offline?)");
      });
      break;
    case "p-bm":
      V.bm = pAddMonths(V.bm || pMonthNow(), +v);
      render();
      break;
    case "p-budget":
      pBudgetSheet(v);
      break;
    case "p-budget-save":
      pBudgetSave();
      break;
    case "p-budget-del": {
      const id = F.cat;
      closeSheet();
      delete pBudgets()[id];
      commit();
      snack(cat(id).name + ": no budget");
      break;
    }
    case "p-addsav":
      accForm();
      pickType("savings");
      break;
    case "p-addcard":
      accForm();
      pickType("card");
      break;
    case "p-addother":
      openSheet(
        "Add",
        '<div class="list"><button class="tx" data-act="asset-edit">' +
          emblem({ i: "diamond", c: "#a646c9" }, "em") +
          '<span class="mid"><div class="d">Something I own</div><div class="s">A laptop, a car, a deposit</div></span></button>' +
          '<button class="tx" data-act="loan-new" data-v="lend">' +
          emblem(LOAN_EMB.lend, "em") +
          '<span class="mid"><div class="d">Money I lent</div><div class="s">Shows here until it comes back</div></span></button></div>'
      );
      break;
    case "p-pay":
      closeSheet();
      trSheet();
      {
        const to = $('#sheet [data-act="tr-to"][data-v="' + v + '"]');
        if (to) to.click();
      }
      break;
    case "p-gold":
      pGoldForm(v);
      break;
    case "p-touch":
      F.touch = v === "yes";
      setPressed("p-touch", v);
      break;
    case "p-gold-save":
      pGoldSave();
      break;
    case "p-gold-del": {
      const id = F.id;
      closeSheet();
      withUndo("Gold deleted", () => {
        S.assets = S.assets.filter(x => x.id !== id);
      });
      break;
    }
    case "p-avail": {
      const a = acc(v);
      a.avail = !pAvail(a);
      el.setAttribute("aria-checked", a.avail);
      commit();
      break;
    }
    case "p-rule":
      pRuleForm(v);
      break;
    case "p-rule-new":
      pRuleForm(null, v);
      break;
    case "p-rtype": {
      const keep = { name: $("#p-rname").value, amt: $("#p-ramt").value, day: $("#p-rday").value },
        f = Object.assign({}, F, { type: v, cat: v === "income" ? "income" : "bills" });
      if (v === "income" && acc(f.account) && acc(f.account).type === "card") f.account = (activeAccounts().find(a => a.type !== "card") || {}).id || null;
      const r = f.id ? pRules().find(x => x.id === f.id) : null;
      F = f;
      openSheet(r ? r.name : v === "income" ? "Recurring income" : "Recurring bill", pRuleBody(r));
      F = f; // openSheet keeps F, but be sure it's the new one
      $("#p-rname").value = keep.name;
      $("#p-ramt").value = keep.amt;
      $("#p-rday").value = keep.day;
      break;
    }
    case "p-rcur":
      curPicker(F.cur, c => {
        F.cur = c;
        closeSheet2();
        $("#p-rcur span").textContent = c;
      });
      break;
    case "p-racc":
      F.account = v;
      setPressed("p-racc", v);
      break;
    case "p-rcat":
      F.cat = v;
      setPressed("p-rcat", v);
      break;
    case "p-rule-save":
      pRuleSave();
      break;
    case "p-rule-del": {
      const id = F.id;
      closeSheet();
      S.rules = pRules().filter(x => x.id !== id);
      commit();
      snack("Deleted");
      break;
    }
    case "p-confirm":
      pConfirm(v);
      break;
    case "p-skip":
      pSkip(v);
      break;
  }
});
document.addEventListener("input", ev => {
  if (ev.target && ev.target.id === "p-grams") pGoldPreview();
});
