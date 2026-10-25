// Tests for web/js/p-logic.js. Run from the repository root: node --test web/tests/logic.check.cjs
// (Named .check.cjs so the main app's Vitest doesn't pick it up.)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// p-logic.js is a classic browser script (globals, no exports): run it and pick its functions by name.
const NAMES = ["pRate", "pConv", "pRatesOn", "pGram", "pGoldValue", "pWorth", "pOccurrences", "pNextIncome", "pPending",
  "pAddMonths", "pBudget"];
const src = fs.readFileSync(path.join(__dirname, "../js/p-logic.js"), "utf8");
const L = new Function(src + "\nreturn {" + NAMES.join(",") + "};")();

const rates = { USD: 1, TRY: 49.50379267, CZK: 21.66332137, EUR: 0.88987006, UAH: 44.90175447, XAU: 0.0002390663 };
const cents = n => Math.round(n * 100);

test("converts every pair through USD, rounded to the target's decimals", () => {
  assert.equal(L.pConv(20, "USD", "TRY", rates), 990.08);
  assert.equal(L.pConv(20, "USD", "UAH", rates), 898.04);
  assert.equal(L.pConv(100, "EUR", "UAH", rates), 5045.88);
  assert.equal(L.pConv(1000, "CZK", "UAH", rates), 2072.71);
  assert.equal(L.pConv(1000, "UAH", "CZK", rates), 482.46);
  assert.equal(L.pConv(5, "TRY", "TRY", rates), 5);
  assert.equal(L.pConv(5, "GBP", "TRY", rates), null);
  assert.equal(L.pConv(1000, "TRY", "JPY", { ...rates, JPY: 150 }), 3030); // JPY has no decimals
});

test("a day's saved rates win over today's, and fill only what they have", () => {
  const day = L.pRatesOn(rates, { "2026-09-15": { TRY: 48.63291322 } }, "2026-09-15");
  assert.equal(day.TRY, 48.63291322);
  assert.equal(day.CZK, rates.CZK);
  assert.equal(L.pRatesOn(rates, {}, "2026-09-15"), rates);
  assert.equal(L.pConv(20, "USD", "TRY", day), 972.66);
});

test("prices gold per gram at spot in any currency", () => {
  assert.equal(Math.round(L.pGram("TRY", rates)), 6658);
  assert.equal(L.pGoldValue(6800, "TRY", rates), 45271); // same as the main app (4527100 kuruş)
  assert.equal(L.pGoldValue(6800, "GBP", rates), null);
});

const accounts = [
  { id: "bank", name: "Bank", type: "bank", currency: "TRY", bal: 12345.67, avail: true },
  { id: "wise", name: "Wise", type: "wallet", currency: "CZK", bal: 4567.89, avail: true },
  { id: "cash", name: "EUR cash", type: "cash", currency: "EUR", bal: 400, avail: true },
  { id: "uah", name: "UAH cash", type: "cash", currency: "UAH", bal: 2500, avail: true },
  { id: "fund", name: "Fund", type: "savings", currency: "TRY", bal: 9876.54, avail: false },
  { id: "zcard", name: "Ziraat card", type: "card", currency: "TRY", bal: -3456.78 },
  { id: "icard", name: "İş card", type: "card", currency: "TRY", bal: 120 },
];
const assets = [
  { id: "g1", name: "Bracelet", kind: "gold", mg: 6800, touch: true },
  { id: "g2", name: "Coins", kind: "gold", mg: 31103, touch: false },
  { id: "laptop", name: "Laptop", value: 900, currency: "EUR" },
];
const loans = [
  { id: "l1", kind: "lend", name: "Friend", left: 1000, cur: "UAH" },
  { id: "l2", kind: "borrow", name: "Roommate", left: 500, cur: "EUR" },
];

test("Everything I own: every item once, in its group", () => {
  const w = L.pWorth({ cur: "TRY", rates, accounts, assets, loans, bills: 0 });
  const g = Object.fromEntries(w.groups.map(x => [x.key, x]));
  assert.deepEqual(w.groups.map(x => x.key), ["spendable", "gold", "investments", "other"]);
  assert.deepEqual(g.spendable.items.map(i => i.id), ["bank", "wise", "cash", "uah", "icard"]);
  assert.deepEqual(g.gold.items.map(i => i.id + ":" + i.touch), ["g1:true", "g2:false"]);
  assert.deepEqual(g.investments.items.map(i => i.id), ["fund"]);
  assert.deepEqual(g.other.items.map(i => i.id), ["laptop", "l1"]);
  // the card that is owed money is debt, not an asset; the one paid past zero is spendable money
  assert.equal(w.cardDebt, 3456.78);
  assert.equal(w.owe, L.pConv(500, "EUR", "TRY", rates));
  assert.equal(w.goldTouchable, L.pGoldValue(6800, "TRY", rates));
  assert.equal(cents(w.goldTouchable + w.goldUntouchable), cents(g.gold.total));
});

test("the chain: total − debts = net worth; − what you can't use − bills = available now", () => {
  for (const cur of ["TRY", "CZK", "EUR", "UAH", "USD"]) {
    const w = L.pWorth({ cur, rates, accounts, assets, loans, bills: L.pConv(1234.56, "TRY", cur, rates) });
    const g = Object.fromEntries(w.groups.map(x => [x.key, x.total]));
    for (const x of w.groups) assert.equal(cents(x.total), x.items.reduce((q, i) => q + cents(i.value), 0), cur + " " + x.key);
    assert.equal(cents(w.total), cents(g.spendable + g.gold + g.investments + g.other));
    assert.equal(cents(w.netWorth), cents(w.total - w.cardDebt - w.owe));
    // what is left is exactly the money you can use and the touchable gold, less debts and bills
    assert.equal(cents(w.availableNow), cents(g.spendable + w.goldTouchable - w.cardDebt - w.owe - w.bills));
    let run = 0;
    for (const s of w.chain) {
      if (s.total && s.key !== "assets") assert.equal(cents(s.value), cents(run), cur + " " + s.key);
      run = s.total ? s.value : run + s.value;
    }
    assert.deepEqual(w.missing, []);
  }
  assert.ok(L.pWorth({ cur: "GBP", rates, accounts, assets, loans, bills: 0 }).missing.includes("TRY"));
});

test("recurring: occurrences, next income, and bills waiting before it", () => {
  const rules = [
    { id: "salary", type: "income", amount: 60000, currency: "TRY", day: 1, start: "2026-10" },
    { id: "dorm", type: "expense", amount: 6300, currency: "CZK", day: 20, start: "2026-10" },
    { id: "ai", type: "expense", amount: 20, currency: "USD", day: 28, start: "2026-10" },
    { id: "old", type: "expense", amount: 5, currency: "USD", day: 5, start: "2026-01", end: "2026-06" },
  ];
  const txns = [{ id: "t", rule: "salary", rmonth: "2026-10" }, { id: "u", rule: "dorm", rmonth: "2026-10" }];
  assert.equal(L.pNextIncome(rules, txns, [], "2026-10-25"), "2026-11-01");
  const p = L.pPending(rules, txns, [], "2026-10-25");
  assert.deepEqual(p.income, []);
  assert.deepEqual(p.bills.map(o => o.rule.id + " " + o.date), ["ai 2026-10-28"]);
  const q = L.pPending(rules, txns, [], "2026-11-02");
  assert.deepEqual(q.income.map(o => o.date), ["2026-11-01"]);
  assert.deepEqual(q.bills.map(o => o.rule.id + " " + o.date), ["ai 2026-10-28", "dorm 2026-11-20", "ai 2026-11-28"]);
  assert.deepEqual(L.pPending(rules, txns, [{ rule: "ai", month: "2026-10" }], "2026-10-25").bills, []);
  assert.equal(L.pOccurrences([{ id: "x", type: "expense", day: 31 }], [], [], "2026-02")[0].date, "2026-02-28");
  // a rule started this month doesn't ask for last month; with no income the window is the next 30 days
  const fresh = [{ id: "gym", type: "expense", amount: 450, currency: "TRY", day: 3, start: "2026-11" }];
  assert.deepEqual(L.pPending(fresh, [], [], "2026-11-10").bills.map(o => o.date), ["2026-11-03", "2026-12-03"]);
});

test("budgets: spending at its own day's rate, bills to come, status, and what's left", () => {
  const latest = { USD: 1, TRY: 50, CZK: 20, EUR: 0.9 };
  const b = L.pBudget({
    cur: "TRY",
    month: "2026-11",
    today: "2026-11-10",
    cats: ["groceries", "food", "housing", "bills", "health"].map(id => ({ id })),
    budgets: {
      groceries: { amount: 4000, currency: "CZK" }, // 10,000 TRY at today's rate
      food: { amount: 3000, currency: "TRY" },
      housing: { amount: 15000, currency: "TRY" },
      bills: { amount: 1000, currency: "TRY" },
    },
    spend: [
      { date: "2026-11-03", cat: "groceries", amount: 1000, currency: "CZK" }, // that day CZK was 25 → 2,000 TRY
      { date: "2026-11-08", cat: "groceries", amount: 500, currency: "CZK" }, // no saved rate → today's: 1,250 TRY
      { date: "2026-11-05", cat: "food", amount: 1500, currency: "TRY" },
      { date: "2026-11-02", cat: "bills", amount: 1200, currency: "TRY" },
      { date: "2026-11-06", cat: "health", amount: 300, currency: "TRY" },
    ],
    coming: [{ cat: "housing", amount: 6300, currency: "CZK" }], // 15,750 TRY
    billCats: ["housing", "bills"],
    latest,
    fxDays: { "2026-11-03": { CZK: 25 } },
    income: 60000,
  });
  const row = id => b.rows.find(x => x.cat === id);
  assert.deepEqual(row("groceries"), { cat: "groceries", budget: 10000, spent: 3250, coming: 0, left: 6750, status: "ok" });
  assert.equal(row("food").status, "ahead"); // 1,500 spent by day 10 of 30 against 3,000: the pace is 1,000
  assert.equal(row("housing").status, "tight"); // nothing spent yet, but the dorm bill takes it over
  assert.equal(row("housing").left, -750);
  assert.equal(row("bills").status, "over");
  assert.equal(row("health").status, "none");
  assert.equal(b.total, 29000);
  assert.equal(b.spentIn, 5950);
  assert.equal(b.coming, 15750);
  assert.equal(b.left, 7300);
  assert.equal(b.daysLeft, 21); // the 10th to the 30th
  assert.equal(b.perDay, 347.62);
  assert.equal(b.spent, 6250);
  assert.equal(b.unbudgeted, 300);
  assert.equal(b.unbudgetedCount, 1);
  assert.equal(b.noBudget, 1);
  assert.equal(b.unassigned, 31000);
  assert.equal(b.missing, false);
});

test("budgets: a past month has no pace and no days left; spending in an unknown currency is flagged", () => {
  const b = L.pBudget({
    cur: "TRY", month: "2026-10", today: "2026-11-10", cats: [{ id: "food" }],
    budgets: { food: { amount: 3000, currency: "TRY" } },
    spend: [{ date: "2026-10-05", cat: "food", amount: 2000, currency: "TRY" }, { date: "2026-10-06", cat: "food", amount: 5, currency: "GBP" }],
    coming: [], billCats: [], latest: { USD: 1, TRY: 50 }, fxDays: {}, income: null,
  });
  assert.equal(b.rows[0].status, "ok");
  assert.equal(b.daysLeft, 0);
  assert.equal(b.perDay, 0);
  assert.equal(b.unassigned, null);
  assert.equal(b.missing, true);
});
