/*
 * p-app.js — Prosperity's additions to Tally's screens: one total in your main currency at live rates, "Everything I
 * own" with the chain to net worth and available now, gold in grams, card interest rules and payoff, and recurring
 * income and bills. Tally's own screens are wrapped or replaced here (render() calls them by name), so Tally's files
 * stay almost as they are upstream. The maths lives in p-logic.js; rates in p-fx.js.
 */
"use strict";

/* ---------- data ---------- */

/* migrate() rebuilds every record from the fields Tally knows; this puts Prosperity's fields back, checked */
function pMigrate(o, s) {
  const byId = list => new Map((Array.isArray(list) ? list : []).filter(x => x && typeof x.id === "string").map(x => [x.id, x])),
    num = v => (typeof v === "number" && isFinite(v) && v >= 0 ? v : undefined),
    isMonth = v => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
  const oa = byId(o.accounts);
  s.accounts.forEach(a => {
    const x = oa.get(a.id) || {};
    if (typeof x.avail === "boolean") a.avail = x.avail;
    if (x.terms && typeof x.terms === "object") {
      const t = {};
      ["rate", "tax", "minPct", "minFloor", "late", "stmtDay", "dueDay"].forEach(k => {
        if (num(x.terms[k]) !== undefined) t[k] = x.terms[k];
      });
      if (P_PRESETS[x.terms.preset]) t.preset = x.terms.preset;
      if (x.terms.base === "remainder" || x.terms.base === "statement") t.base = x.terms.base;
      a.terms = t;
    }
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
      currency: /^[A-Z]{3}$/.test(r.currency) ? r.currency : s.settings.cur || "USD",
      account: s.accounts.some(a => a.id === r.account) ? r.account : null,
      cat: typeof r.cat === "string" ? r.cat : null,
      day: Math.min(31, Math.max(1, Math.round(num(r.day) || 1))),
      start: isMonth(r.start) ? r.start : null,
      end: isMonth(r.end) ? r.end : null,
    }));
  s.skips = (Array.isArray(o.skips) ? o.skips : [])
    .filter(k => k && typeof k.rule === "string" && isMonth(k.month))
    .map(k => ({ rule: k.rule, month: k.month }));
}
const pRules = () => S.rules || (S.rules = []);
const pSkips = () => S.skips || (S.skips = []);
/* savings don't count as money you can use unless you say so; every other account does unless you say not */
const pAvail = a => (typeof a.avail === "boolean" ? a.avail : a.type !== "savings");
const pCur = () => S.settings.cur || (activeAccounts()[0] || {}).currency || "USD";
const pMonthNow = () => today().slice(0, 7);
const approx = (n, cur) => "≈ " + money(n, cur);

/* everything the screens show, worked out once per render */
let PM = null;
const tallyRender = render;
render = function () {
  PM = null;
  tallyRender();
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
  if (billsMissing && !w.missing.includes("rates")) w.missing.push("rates");
  const cards = accounts
    .filter(a => a.type === "card")
    .map(a => {
      const t = pTerms(a),
        debt = Math.max(0, -a.bal),
        dm = pToMinor(debt, a.currency),
        floor = pToMinor(t.minFloor, a.currency),
        next = t.rate ? pFromMinor(pCycleInterest(dm, pMinimum(dm, t, floor), t, floor), a.currency) : null;
      return { a, t, debt, dm, floor, next, nextConv: next === null ? 0 : pConv(next, a.currency, cur, rates) || 0 };
    });
  return (PM = { cur, rates, b, accounts, loans, pend, w, cards });
}
const ratesLine = () =>
  PFX.date
    ? "Rates of " + dayLabel(PFX.date) + (PFX.goldAt ? " · gold live" : "")
    : "Rates not loaded yet: other currencies count as 0";

/* ---------- Home ---------- */

const tallyHomeView = homeView;
homeView = function () {
  const h = tallyHomeView();
  if (!activeAccounts().length)
    return h.replace(
      "Add first account</button>",
      'Add first account</button><div class="gap"></div><button class="btn tonal" data-act="p-demo">Try it with sample data</button>'
    );
  const m = pModel(),
    cur = m.cur;
  const avail =
    '<button class="balbar p-avail" data-act="p-chain">' +
    ic("wallet") +
    '<span class="l">Available now</span><b>' +
    esc(money(m.w.availableNow, cur)) +
    "</b></button>";
  return h.replace('<button class="balbar"', avail + '<button class="balbar"').replace(
    'Lend</button></div>',
    "Lend</button></div>" + pWaiting(m)
  );
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
          k = cat(r.cat),
          d = daysBetween(t, o.date),
          when = d === 0 ? "today" : d > 0 ? "in " + d + (d === 1 ? " day" : " days") : -d + (d === -1 ? " day late" : " days late"),
          conv = r.currency !== m.cur ? pConv(r.amount, r.currency, m.cur, m.rates) : null;
        return (
          '<button class="tx" data-act="p-confirm" data-v="' +
          esc(r.id + "|" + o.month) +
          '">' +
          emblem(k, "em") +
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
  investments: "Investments & savings",
  other: "Other assets & money owed to me",
  bills: "Bills before next income",
  availableNow: "Available now",
};
const P_STEP_TAB = { cards: "liabs", owe: "liabs", goldUntouchable: "assets", investments: "assets", other: "assets" };
function chainHTML(m) {
  return m.w.chain
    .map(s => {
      const label = s.key === "bills" && m.pend.payday ? P_STEP.bills + " (" + dayLabel(m.pend.payday) + ")" : P_STEP[s.key],
        tab = P_STEP_TAB[s.key];
      return (
        "<" +
        (tab ? 'button data-act="p-tab" data-v="' + tab + '"' : "div") +
        ' class="p-line' +
        (s.total ? " tot" : "") +
        (s.key === "availableNow" ? " end" : "") +
        '"><span>' +
        (s.total ? "= " : "− ") +
        esc(label) +
        "</span><b>" +
        esc(money(s.total ? s.value : Math.abs(s.value), m.cur)) +
        "</b></" +
        (tab ? "button" : "div") +
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
      '. Bills are the recurring ones still to pay before your next income.</p><div class="gap"></div><button class="btn tonal" data-act="p-tab" data-v="assets">See everything I own</button>'
  );
}

/* ---------- Assets: everything I own ---------- */

const P_GROUP = {
  spendable: ["Spendable money", "Accounts, wallets and cash you can use."],
  goldTouchable: ["Touchable gold", "Gold you would sell if you needed to."],
  goldUntouchable: ["Untouchable gold", "Gold you keep, whatever happens."],
  investments: ["Investments & savings", "Accounts you don't count as money you can use, like a fund."],
  other: ["Other assets & money owed to me", "Things you own, and money you lent."],
};
function pItemRow(it, cur) {
  const small = it.currency && it.currency !== cur ? "<small>" + esc(approx(it.value, cur)) + "</small>" : "";
  if (it.acc) {
    const a = acc(it.id);
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
      '</div></span><span class="a">' +
      esc(money(it.amount, a.currency)) +
      small +
      "</span></button>"
    );
  }
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
      esc(approx(it.value, cur)) +
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
    small +
    "</span></button>"
  );
}
const pGrams = mg => (mg / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + " g";
const P_ADD = {
  spendable: [["acc-form", "", "Add account"]],
  goldTouchable: [["p-gold", "new-touch", "Add gold"]],
  goldUntouchable: [["p-gold", "new-keep", "Add gold"]],
  investments: [],
  other: [
    ["asset-edit", "", "Add asset"],
    ["loan-new", "lend", "Lend money"],
  ],
};
assetsView = function () {
  const m = pModel(),
    cur = m.cur;
  let h =
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
  const sections = m.w.groups.map(g => {
    const add = P_ADD[g.key]
      .map(
        ([act, v, label]) =>
          '<button class="btn text" data-act="' + act + '"' + (v ? ' data-v="' + v + '"' : "") + ' style="margin-top:4px">' + ic("add") + esc(label) + "</button>"
      )
      .join("");
    return (
      '<div class="sec p-sec"><span>' +
      esc(P_GROUP[g.key][0]) +
      "</span><b>" +
      esc(money(g.total, cur)) +
      "</b></div>" +
      (g.items.length
        ? '<div class="list">' + g.items.map(it => pItemRow(it, cur)).join("") + "</div>"
        : '<p class="hint" style="margin:0 4px">' + esc(P_GROUP[g.key][1]) + "</p>") +
      add
    );
  });
  const arch = S.accounts.filter(a => a.archived);
  let archived = "";
  if (arch.length) {
    archived =
      '<button class="btn text" data-act="toggle-arch">' + (V.showArchived ? "Hide" : "Show") + " archived (" + arch.length + ")</button>";
    if (V.showArchived) archived += '<div class="list">' + arch.map(a => accRow(a, m.b)).join("") + "</div>";
  }
  const chain = '<div class="sec">How it adds up</div><div class="card p-chain">' + chainHTML(m) + "</div>";
  const left = h + sections.slice(0, 3).join("") + archived,
    right = sections.slice(3).join("") + chain;
  return tabBar("Assets") + panes(left, right);
};

/* ---------- Liabilities: cards with interest, loans ---------- */

liabsView = function () {
  const m = pModel(),
    cur = m.cur,
    owing = m.cards.filter(c => c.debt > 0),
    monthly = m.cards.reduce((q, c) => q + c.nextConv, 0);
  let h =
    '<div class="sumcard owe"><div class="t">You owe</div><div class="big">' +
    esc(money(m.w.cardDebt + m.w.owe, cur)) +
    "</div>" +
    (monthly > 0 ? '<div class="t small">Card interest ≈ ' + esc(money(monthly, cur)) + " a month if you pay only the minimums</div>" : "") +
    "</div>";
  h += loanSection("borrow", "Loans", "Money you borrow shows here until it’s paid back.", "Record a loan");
  let right = "";
  if (m.cards.length) {
    right += '<div class="sec">Credit cards</div><div class="list">' + m.cards.map(c => pCardRow(c, cur)).join("") + "</div>";
    if (owing.length > 1) right += pAllCardsCard(m);
  }
  right += '<button class="btn text" data-act="acc-form" style="margin-top:4px">' + ic("add") + "Add a credit card</button>";
  return tabBar("Liabilities") + panes(h, right);
};
function pCardRow(c, cur) {
  const a = c.a,
    sub = c.t.rate
      ? c.debt > 0
        ? "≈ " + money(c.next, a.currency) + " a month"
        : c.t.rate + "% a month · nothing owed"
      : "Set interest rules";
  return (
    '<button class="tx" data-act="p-card" data-v="' +
    a.id +
    '">' +
    emblem(accEmb(a), "em") +
    '<span class="mid"><div class="d" dir="auto">' +
    esc(a.name) +
    '</div><div class="s' +
    (c.t.rate ? "" : " p-warn") +
    '">' +
    esc(sub) +
    '</div></span><span class="a' +
    (c.debt > 0 ? " p-debt" : "") +
    '">' +
    esc(money(c.debt > 0 ? c.debt : a.bal, a.currency)) +
    (a.currency !== cur && c.debt > 0 ? "<small>" + esc(approx(pConv(c.debt, a.currency, cur, pRates()) || 0, cur)) + "</small>" : "") +
    "</span></button>"
  );
}
/* every card with debt in the main currency: which to pay first */
function pAllCards(m) {
  return m.cards
    .filter(c => c.debt > 0)
    .map(c => ({
      id: c.a.id,
      c,
      balance: pToMinor(pConv(c.debt, c.a.currency, m.cur, m.rates) || 0, m.cur),
      t: c.t,
      floor: pToMinor(pConv(c.t.minFloor, c.a.currency, m.cur, m.rates) || 0, m.cur),
    }));
}
const pRealRate = t => (t.rate ? pMonthly(t.rate, t.tax) : 0);
const pPct = (f, d) => (f * 100).toLocaleString(undefined, { maximumFractionDigits: d === undefined ? 2 : d }) + "%";
function pAllCardsCard(m) {
  const order = pOrder(pAllCards(m)),
    first = order[0];
  return (
    '<div class="card"><h3>Pay ' +
    esc(first.c.a.name) +
    ' first</h3><p class="muted small" style="margin:0">' +
    (first.t.rate
      ? "It costs the most: " + esc(pPct(pRealRate(first.t))) + " a month with taxes. Pay every card's minimum and put the rest here."
      : "Set each card's interest rules to see which costs the most.") +
    '</p><div class="gap"></div><button class="btn tonal" data-act="p-allcards">Plan paying them all off</button></div>'
  );
}
function pAllCardsSheet() {
  const m = pModel(),
    cards = pAllCards(m),
    mins = cards.reduce((q, c) => q + pMinimum(c.balance, c.t, c.floor), 0),
    suggest = pFromMinor(Math.ceil((mins * 2) / pToMinor(100, m.cur)) * pToMinor(100, m.cur), m.cur);
  F = { kind: "pall" };
  openSheet(
    "All cards",
    '<p class="muted small" style="margin:0 0 8px">In ' +
      esc(m.cur) +
      ". Every card gets its minimum; everything else goes to the card that costs the most, then the next.</p>" +
      amtField("p-allamt", m.cur, String(suggest), { label: "I can put this toward cards each month" }) +
      '<div id="p-allres"></div>'
  );
  pAllCardsUpdate();
}
function pAllCardsUpdate() {
  const box = $("#p-allres"),
    inp = $("#p-allamt");
  if (!box || !inp) return;
  const m = pModel(),
    cards = pAllCards(m),
    monthly = pToMinor(evalAmt(inp.value) || 0, m.cur),
    r = pSimulateAll(cards, monthly),
    mins = cards.reduce((q, c) => q + (pSimulate(c.balance, c.t, { type: "minimum" }, c.floor).interest || 0), 0),
    fmt = n => money(pFromMinor(n, m.cur), m.cur);
  box.innerHTML =
    '<div class="list" style="margin-top:12px">' +
    r.order
      .map(
        (c, i) =>
          '<div class="tx"><span class="mid"><div class="d">' +
          (i + 1) +
          ". " +
          esc(c.c.a.name) +
          '</div><div class="s">' +
          esc(c.t.rate ? pPct(pRealRate(c.t)) + " a month" : "No rate yet") +
          (r.clearedIn[c.id] ? " · cleared in month " + r.clearedIn[c.id] : "") +
          '</div></span><span class="a p-debt">' +
          esc(fmt(c.balance)) +
          "</span></div>"
      )
      .join("") +
    "</div>" +
    (r.short ? '<p class="hint p-warn">That doesn’t cover this month’s minimums. Late interest would apply.</p>' : "") +
    '<div class="card" style="margin-top:12px"><h3>' +
    esc(r.paidOff ? "All cleared in " + r.months + (r.months === 1 ? " month" : " months") : "Never: this doesn’t cover the interest") +
    "</h3>" +
    (r.paidOff ? '<p class="muted small" style="margin:0">About ' + esc(fmt(r.interest)) + " interest in total. Paying only the minimums: " + esc(fmt(mins)) + ".</p>" : "") +
    "</div>";
}

/* one card: what it costs, and a payoff simulator in its own currency */
function pCardSheet(id) {
  const m = pModel(),
    c = m.cards.find(x => x.a.id === id);
  if (!c) return;
  const a = c.a,
    t = c.t,
    cost = pRealRate(t);
  F = { kind: "pcard", id };
  let h =
    '<div class="hero">' +
    emblem(accEmb(a), "cprev") +
    '<div class="t">' +
    esc(c.debt > 0 ? "Owed now" : "Nothing owed") +
    '</div><div class="v">' +
    esc(money(c.debt, a.currency)) +
    "</div></div>";
  h +=
    '<div class="card"><h3>' +
    esc(t.rate ? t.rate + "% a month on " + (t.base === "statement" ? "the whole statement" : "what you leave unpaid") : "No interest rules yet") +
    '</h3><p class="muted small" style="margin:0">' +
    (t.rate
      ? esc(
          (t.tax ? "Plus " + t.tax + "% tax on the interest. " : "") +
            "Real cost " +
            pPct(cost) +
            " a month, " +
            pPct(pYearly(cost), 0) +
            " a year. Minimum " +
            t.minPct +
            "%" +
            (t.minFloor ? ", at least " + money(t.minFloor, a.currency) : "") +
            "."
        ) +
        (c.debt > 0 ? "<br>Next statement interest if you pay the minimum: <b>" + esc(money(c.next, a.currency)) + "</b>" : "") +
        (t.stmtDay && t.dueDay ? "<br>" + esc("Statement on the " + t.stmtDay + ", pay by the " + t.dueDay + ".") : "")
      : "Add the bank's monthly rate to see what this debt costs.") +
    '</p><div class="gap"></div><button class="btn tonal" data-act="p-terms" data-v="' +
    a.id +
    '">' +
    ic("edit") +
    "Interest rules</button></div>";
  if (t.rate && c.debt > 0) {
    h +=
      '<div class="card"><h3>Paying it off</h3>' +
      amtField("p-fixed", a.currency, String(Math.round(c.debt / 4)), { label: "A fixed amount each month" }) +
      '<div id="p-sim"></div></div>';
  }
  h +=
    '<div class="row">' +
    (c.debt > 0 ? '<button class="btn" data-act="p-pay" data-v="' + a.id + '">' + ic("swap") + "Pay card</button>" : "") +
    '<button class="btn tonal" data-act="hist-acc" data-v="' +
    a.id +
    '">' +
    ic("list") +
    "History</button></div>" +
    '<div class="gap"></div><button class="btn text" data-act="acc-open" data-v="' +
    a.id +
    '">Balance & account</button>';
  openSheet(a.name, h);
  pSimUpdate();
}
function pSimUpdate() {
  const box = $("#p-sim"),
    inp = $("#p-fixed");
  if (!box || !inp || !F || F.kind !== "pcard") return;
  const c = pModel().cards.find(x => x.a.id === F.id);
  if (!c) return;
  const cur = c.a.currency,
    fixed = pToMinor(evalAmt(inp.value) || 0, cur),
    rows = [
      ["Pay the full statement", pSimulate(c.dm, c.t, { type: "full" }, c.floor)],
      ["Minimum payment (" + c.t.minPct + "%)", pSimulate(c.dm, c.t, { type: "minimum" }, c.floor)],
      ["Fixed: " + money(pFromMinor(fixed, cur), cur), pSimulate(c.dm, c.t, { type: "fixed", amount: fixed }, c.floor)],
    ];
  box.innerHTML =
    '<div class="list" style="margin-top:10px">' +
    rows
      .map(
        ([label, r]) =>
          '<div class="tx"><span class="mid"><div class="d">' +
          esc(label) +
          "</div>" +
          (r.belowMin ? '<div class="s p-warn">Below the minimum: late interest applies</div>' : "") +
          '</span><span class="a' +
          (r.paidOff && r.interest ? " p-debt" : "") +
          '">' +
          esc(r.paidOff ? r.months + (r.months === 1 ? " month" : " months") : "Never") +
          "<small>" +
          esc(r.paidOff ? money(pFromMinor(r.interest, cur), cur) + " interest" : "doesn’t cover the interest") +
          "</small></span></div>"
      )
      .join("") +
    "</div>";
}
function pTermsForm(id) {
  const a = acc(id);
  if (!a) return;
  const t = pTerms(a);
  F = { kind: "pterms", id, preset: t.preset, base: t.base };
  const fld = (fid, label, v, hint) =>
    '<label class="field"><span>' +
    esc(label) +
    '</span><input id="' +
    fid +
    '" inputmode="decimal" autocomplete="off" value="' +
    esc(v === null || v === undefined ? "" : String(v)) +
    '" placeholder="' +
    esc(hint || "") +
    '"></label>';
  const h =
    '<div class="lbl" style="margin-top:0">Rules of</div><div class="seg">' +
    ["turkey", "generic"]
      .map(k => '<button data-act="p-preset" data-v="' + k + '" aria-pressed="' + (t.preset === k) + '">' + (k === "turkey" ? "Turkey" : "Generic") + "</button>")
      .join("") +
    '</div><p class="hint" id="p-preset-hint">' +
    esc(P_PRESET_HINT[t.preset]) +
    "</p>" +
    '<div class="row">' +
    fld("p-rate", "Monthly rate (%)", t.rate, t.preset === "turkey" ? "3.75" : "3.1") +
    fld("p-tax", "Tax on interest (%)", t.tax) +
    "</div>" +
    '<div class="lbl">Interest is charged on</div><div class="seg">' +
    [["remainder", "What is left unpaid"], ["statement", "The whole statement"]]
      .map(([k, l]) => '<button data-act="p-base" data-v="' + k + '" aria-pressed="' + (t.base === k) + '">' + l + "</button>")
      .join("") +
    "</div>" +
    '<div class="row">' +
    fld("p-minpct", "Minimum (%)", t.minPct) +
    fld("p-minfloor", "At least (" + a.currency + ")", t.minFloor || "", "optional") +
    "</div>" +
    '<div class="row">' +
    fld("p-late", "Late interest, extra points", t.late) +
    fld("p-stmt", "Statement day", t.stmtDay, "1–31") +
    fld("p-due", "Due day", t.dueDay, "1–31") +
    "</div>" +
    '<p class="hint" id="p-tprev"></p><div class="gap"></div><button class="btn" data-act="p-terms-save">' +
    ic("check") +
    "Save</button>";
  openSheet(a.name + ": interest rules", h);
  pTermsPreview();
}
const P_PRESET_HINT = {
  turkey:
    "Interest only on what you leave unpaid after the due date, plus KKDF 15% + BSMV 15% on it. Minimum 20%. Paying less than the minimum adds about 0.30 points of late interest on the missing part.",
  generic:
    "No taxes; type your bank's numbers. Many cards outside Turkey charge the whole statement once it isn't paid in full: check your bank's tariff.",
};
function pTermsRead() {
  const n = id => {
    const v = ($("#" + id) || {}).value || "";
    if (!v.trim()) return null;
    const x = evalAmt(v);
    return x !== null && x >= 0 ? x : NaN;
  };
  const t = {
    preset: F.preset,
    base: F.base,
    rate: n("p-rate"),
    tax: n("p-tax"),
    minPct: n("p-minpct"),
    minFloor: n("p-minfloor"),
    late: n("p-late"),
    stmtDay: n("p-stmt"),
    dueDay: n("p-due"),
  };
  return t;
}
function pTermsPreview() {
  const el = $("#p-tprev");
  if (!el) return;
  const t = pTermsRead();
  el.textContent = t.rate > 0 ? "Real cost " + pPct(pMonthly(t.rate, t.tax || 0)) + " a month, " + pPct(pYearly(pMonthly(t.rate, t.tax || 0)), 0) + " a year." : "";
}
function pTermsSave() {
  const t = pTermsRead();
  if (Object.values(t).some(v => typeof v === "number" && isNaN(v))) return snack("That isn't a number");
  if ((t.stmtDay !== null && (t.stmtDay < 1 || t.stmtDay > 31)) || (t.dueDay !== null && (t.dueDay < 1 || t.dueDay > 31)))
    return snack("Days go from 1 to 31");
  const a = acc(F.id),
    clean = {};
  Object.keys(t).forEach(k => {
    if (t[k] !== null && t[k] !== undefined) clean[k] = t[k];
  });
  a.terms = clean;
  const id = F.id;
  closeSheet();
  commit();
  snack("Interest rules saved");
  pCardSheet(id);
}

/* ---------- gold ---------- */

function pGoldForm(v) {
  const x = v && !v.startsWith("new") ? S.assets.find(a => a.id === v) : null;
  F = { kind: "pgold", id: x ? x.id : null, touch: x ? x.touch : v === "new-touch" };
  const h =
    '<label class="field"><span>Name</span><input id="p-gname" maxlength="30" value="' +
    esc(x ? x.name : "Gold") +
    '" placeholder="e.g. Bracelet, coins"></label>' +
    '<label class="field"><span>Grams</span><input id="p-grams" inputmode="decimal" autocomplete="off" value="' +
    esc(x ? String(x.mg / 1000) : "") +
    '" placeholder="0"></label>' +
    '<div class="seg">' +
    [["yes", "Touchable"], ["no", "Untouchable"]]
      .map(([k, l]) => '<button data-act="p-touch" data-v="' + k + '" aria-pressed="' + ((k === "yes") === F.touch) + '">' + l + "</button>")
      .join("") +
    '</div><p class="hint">Touchable gold counts as money you can use; untouchable gold only counts in net worth.</p>' +
    '<p class="hint" id="p-gprev"></p><div class="gap"></div><button class="btn" data-act="p-gold-save">' +
    (x ? "Save" : "Add gold") +
    "</button>" +
    (x ? '<div class="gap"></div><button class="btn danger" data-act="p-gold-del">Delete</button>' : "");
  openSheet(x ? "Edit gold" : "Gold", h);
  pGoldPreview();
}
function pGoldPreview() {
  const el = $("#p-gprev");
  if (!el) return;
  const cur = pCur(),
    g = pGram(cur, pRates()),
    grams = evalAmt(($("#p-grams") || {}).value || "") || 0;
  el.textContent = g === null ? "No gold price yet (offline)." : money(g, cur) + " a gram at spot" + (grams ? " · ≈ " + money(g * grams, cur) : "");
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
  openSheet(r ? "Edit recurring" : type === "income" ? "Recurring income" : "Recurring bill", pRuleBody(r));
}
function pRuleBody(r) {
  const cats = F.type === "income" ? inCats() : outCats(),
    accs = activeAccounts().filter(a => F.type === "expense" || a.type !== "card");
  return (
    '<div class="seg">' +
    [["expense", "Bill"], ["income", "Income"]]
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
    '" placeholder="0"></label><label class="field"><span>Day of month</span><input id="p-rday" inputmode="numeric" value="' +
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
    '</div><p class="hint">Each month it waits on Home until you confirm it, with the amount that really moved. A different currency is converted into the account’s at that day’s rate.</p><div class="gap"></div><button class="btn" data-act="p-rule-save">' +
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
  const data = { type: F.type, name, amount, currency: F.cur, account: F.account, cat: F.cat, day };
  if (F.id) Object.assign(pRules().find(x => x.id === F.id), data);
  else pRules().push(Object.assign({ id: newId(), start: pMonthNow(), end: null }, data));
  closeSheet();
  commit();
  snack(F && F.id ? "Saved" : name + " added");
}
/* confirming one month: Tally's own entry sheet, prefilled, in the account's currency */
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
      (r.currency !== a.currency
        ? '<p class="hint">' + esc(money(r.amount, r.currency) + " at today's rate. Change it to what was really charged.") + "</p>"
        : "") +
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

/* ---------- account sheet: "counts as money I can use" ---------- */

const tallyAccOpen = accOpen;
accOpen = function (id) {
  tallyAccOpen(id);
  const a = acc(id),
    p = $("#sheet .p");
  if (!a || !p) return;
  const extra =
    a.type === "card"
      ? '<div class="gap"></div><button class="btn tonal" data-act="p-card" data-v="' + a.id + '">' + ic("card") + "Interest & payoff</button>"
      : '<div class="list" style="margin-top:12px"><div class="setrow"><span class="mid"><div>Counts as money I can use</div><div class="s">Off for savings you don’t touch, like a fund</div></span><button class="sw" role="switch" data-act="p-avail" data-v="' +
        a.id +
        '" aria-checked="' +
        pAvail(a) +
        '" aria-label="Counts as money I can use"></button></div></div>';
  p.insertAdjacentHTML("beforeend", extra);
};

/* ---------- Settings ---------- */

const tallySettingsView = settingsView;
settingsView = function () {
  const h = tallySettingsView(),
    i = h.indexOf("</header>") + "</header>".length,
    rules = pRules().slice().sort((a, b) => (a.type === b.type ? a.day - b.day : a.type === "income" ? -1 : 1));
  const mine =
    '<div class="sec">Recurring income & bills</div>' +
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
      : '<p class="hint" style="margin:0 4px">Salary, rent, subscriptions: each month they wait on Home until you confirm them.</p>') +
    '<div class="row"><button class="btn text" data-act="p-rule-new" data-v="expense">' +
    ic("add") +
    'Bill</button><button class="btn text" data-act="p-rule-new" data-v="income">' +
    ic("add") +
    "Income</button></div>" +
    '<div class="sec">Exchange rates</div><div class="list"><div class="setrow"><span class="mid"><div>' +
    esc(ratesLine()) +
    '</div><div class="s">Totals are shown in your main currency (' +
    esc(pCur()) +
    ')</div></span><button class="btn tonal" data-act="p-fx-refresh">Refresh</button></div></div>' +
    '<div class="sec">Try it</div><div class="list"><div class="setrow"><span class="mid"><div>Sample data</div><div class="s">Replaces everything here with an example notebook</div></span><button class="btn tonal" data-act="p-demo">Load</button></div></div>';
  return h.slice(0, i) + mine + h.slice(i);
};

/* ---------- sample data ---------- */

function pDemo() {
  const go = () => {
    S = migrate(pDemoState());
    PM = null;
    V.screen = "home";
    V.cur = null;
    commit();
    snack("Sample data loaded");
  };
  if (S.accounts.length) askDialog("Replace everything?", "Your accounts and entries here are replaced by the sample.", "Replace", go, { danger: true });
  else go();
}
function pDemoState() {
  const t = today(),
    d = n => addDays(t, n),
    m = pMonthNow(),
    prev = pAddMonths(m, -1),
    ts = n => Date.now() - n * 1000,
    acc = (id, name, type, currency, opening, extra) => Object.assign({ id, name, type, currency, opening, archived: false }, extra || {});
  return {
    v: 6,
    settings: { cur: "TRY", week: 1, clock: "24", lastCheck: t },
    accounts: [
      acc("ziraat", "Ziraat", "bank", "TRY", 2450.75),
      acc("zcard", "Ziraat card", "card", "TRY", -12380.4, { terms: { preset: "turkey", rate: 3.75, stmtDay: 5, dueDay: 15 } }),
      acc("icard", "İş card", "card", "TRY", -4250, { terms: { preset: "turkey", rate: 4.25 } }),
      acc("wisecz", "Wise CZK", "wallet", "CZK", 19420.5),
      acc("wiseeu", "Wise EUR", "wallet", "EUR", 310),
      acc("eurcash", "EUR cash", "cash", "EUR", 400),
      acc("czkcash", "CZK cash", "cash", "CZK", 1250),
      acc("fund", "Mutual fund", "savings", "TRY", 25000, { avail: false }),
    ],
    assets: [
      { id: "g1", name: "Touchable gold", kind: "gold", mg: 5000, touch: true, value: 0, currency: "TRY", i: "diamond", c: "#b8860b" },
      { id: "g2", name: "Untouchable gold", kind: "gold", mg: 20000, touch: false, value: 0, currency: "TRY", i: "diamond", c: "#b8860b" },
    ],
    rules: [
      { id: "salary", type: "income", name: "Salary", amount: 45000, currency: "TRY", account: "ziraat", cat: "income", day: 1, start: prev },
      { id: "dorm", type: "expense", name: "Dorm", amount: 6300, currency: "CZK", account: "wisecz", cat: "housing", day: 20, start: prev },
      { id: "ai", type: "expense", name: "AI subscription", amount: 20, currency: "USD", account: "zcard", cat: "bills", day: 28, start: prev },
    ],
    txns: [
      { id: "s1", ts: ts(90), date: prev + "-01", type: "income", amount: 45000, account: "ziraat", cat: "income", note: "Salary", rule: "salary", rmonth: prev },
      { id: "s2", ts: ts(89), date: prev + "-20", type: "expense", amount: 6300, account: "wisecz", cat: "housing", note: "Dorm", rule: "dorm", rmonth: prev },
      { id: "s3", ts: ts(88), date: prev + "-28", type: "expense", amount: 990.08, account: "zcard", cat: "bills", note: "AI subscription ($20.00)", rule: "ai", rmonth: prev },
      /* this month's recurring entries that are already past are confirmed, so only what's ahead waits on Home */
      ...[
        ["salary", "income", 45000, "ziraat", "income", 1, "Salary"],
        ["dorm", "expense", 6300, "wisecz", "housing", 20, "Dorm"],
        ["ai", "expense", 990.08, "zcard", "bills", 28, "AI subscription ($20.00)"],
      ]
        .filter(r => r[5] < +t.slice(8, 10))
        .map(([rule, type, amount, account, cat, day, note], i) => ({
          id: "c" + i, ts: ts(60 - i), date: m + "-" + String(day).padStart(2, "0"), type, amount, account, cat, note, rule, rmonth: m,
        })),
      { id: "e1", ts: ts(50), date: d(-3), type: "expense", amount: 452.3, account: "wisecz", cat: "groceries", note: "Albert" },
      { id: "e2", ts: ts(40), date: d(-2), type: "expense", amount: 185, account: "czkcash", cat: "food", note: "Canteen" },
      { id: "e3", ts: ts(30), date: d(-1), type: "expense", amount: 1240, account: "zcard", cat: "shopping", note: "Headphones case" },
      { id: "e4", ts: ts(20), date: t, type: "expense", amount: 38.5, account: "wiseeu", cat: "transport", note: "Train" },
      { id: "e5", ts: ts(10), date: t, type: "expense", amount: 129.9, account: "wisecz", cat: "groceries", note: "Lidl" },
      { id: "l1", ts: ts(80), date: d(-12), type: "loan", amount: 3400, account: "wisecz", dir: "in", loan: "fridge", principal: true },
      { id: "l2", ts: ts(70), date: d(-6), type: "loan", amount: 2000, account: "ziraat", dir: "out", loan: "lent", principal: true, due: d(20) },
    ],
    loans: [
      { id: "fridge", ts: ts(80), kind: "borrow", person: "Roommate (fridge)", account: "wisecz", date: d(-12), note: "", status: "open" },
      { id: "lent", ts: ts(70), kind: "lend", person: "Friend", account: "ziraat", date: d(-6), note: "", status: "open" },
    ],
  };
}

/* ---------- clicks and typing ---------- */

document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]");
  if (!el || !el.dataset.act.startsWith("p-")) return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case "p-chain":
      pChainSheet();
      break;
    case "p-tab":
      closeSheet();
      V.screen = v;
      FLIP = v;
      render();
      scrollTo(0, 0);
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
    case "p-card":
      closeSheet();
      pCardSheet(v);
      break;
    case "p-terms":
      pTermsForm(v);
      break;
    case "p-preset": {
      F.preset = v;
      setPressed("p-preset", v);
      const p = P_PRESETS[v];
      $("#p-tax").value = p.tax;
      $("#p-minpct").value = p.minPct;
      $("#p-late").value = p.late;
      F.base = p.base;
      setPressed("p-base", p.base);
      $("#p-preset-hint").textContent = P_PRESET_HINT[v];
      pTermsPreview();
      break;
    }
    case "p-base":
      F.base = v;
      setPressed("p-base", v);
      break;
    case "p-terms-save":
      pTermsSave();
      break;
    case "p-pay":
      closeSheet();
      trSheet();
      {
        const to = $('#sheet [data-act="tr-to"][data-v="' + v + '"]');
        if (to) to.click();
      }
      break;
    case "p-allcards":
      pAllCardsSheet();
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
      const keep = { name: $("#p-rname").value, amt: $("#p-ramt").value, day: $("#p-rday").value };
      const f = Object.assign({}, F, { type: v, cat: v === "income" ? "income" : "bills" });
      if (v === "income" && acc(f.account) && acc(f.account).type === "card")
        f.account = (activeAccounts().find(a => a.type !== "card") || {}).id || null;
      openSheet(v === "income" ? "Recurring income" : "Recurring bill", "");
      F = f;
      $("#sheet .p").insertAdjacentHTML("beforeend", pRuleBody(F.id ? pRules().find(x => x.id === F.id) : null));
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
  const id = ev.target && ev.target.id;
  if (id === "p-fixed") pSimUpdate();
  else if (id === "p-allamt") pAllCardsUpdate();
  else if (id === "p-grams") pGoldPreview();
  else if (["p-rate", "p-tax"].includes(id)) pTermsPreview();
});
