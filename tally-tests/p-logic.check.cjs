// Tests for public/tally/js/p-logic.js. Run: node --test tally-tests/
// (Named .check.cjs so the main app's Vitest doesn't pick it up.)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// p-logic.js is a classic browser script (globals, no exports): run it and pick its functions by name.
const NAMES = ["pRate", "pConv", "pGram", "pGoldValue", "pDigits", "P_PRESETS", "pTerms", "pMonthly", "pYearly",
  "pMinimum", "pCycleInterest", "pSimulate", "pOrder", "pSimulateAll", "pToMinor", "pFromMinor", "pWorth",
  "pOccurrences", "pNextIncome", "pPending", "pAddMonths"];
const src = fs.readFileSync(path.join(__dirname, "../public/tally/js/p-logic.js"), "utf8");
const L = new Function(src + "\nreturn {" + NAMES.join(",") + "};")();

const rates = { USD: 1, TRY: 49.50379267, CZK: 21.66332137, EUR: 0.88987006, UAH: 44.90175447, XAU: 0.0002390663 };

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

test("prices gold per gram at spot in any currency", () => {
  assert.equal(Math.round(L.pGram("TRY", rates)), 6658);
  assert.equal(L.pGoldValue(6800, "TRY", rates), 45271); // same as the main app (4527100 kuruş)
  assert.equal(L.pGoldValue(6800, "GBP", rates), null);
});

test("card terms: a preset fills what the card leaves blank", () => {
  assert.deepEqual(L.pTerms({ currency: "TRY", terms: { rate: 3.75 } }), {
    preset: "turkey", rate: 3.75, tax: 30, minPct: 20, minFloor: 0, base: "remainder", late: 0.3, stmtDay: null, dueDay: null,
  });
  const ua = L.pTerms({ currency: "UAH", terms: { rate: 3.1, minFloor: 100 } });
  assert.equal(ua.preset, "generic");
  assert.equal(ua.base, "statement");
  assert.equal(ua.tax, 0);
});

test("Turkish interest runs only on what is left unpaid (Yapı Kredi's worked example)", () => {
  const bank = { ...L.pTerms({ currency: "TRY", terms: { rate: 3.5, tax: 0, minPct: 40 } }) };
  assert.equal(L.pCycleInterest(100000, 40000, bank, 0), 2100); // 600 TL × 3.5% = 21.00 TL
  assert.equal(L.pCycleInterest(100000, 100000, bank, 0), 0);
  assert.equal(L.pCycleInterest(100000, 10000, bank, 0), 3150 + 90); // plus late interest on the missing minimum
  assert.equal(L.pCycleInterest(100000, 40000, { ...bank, tax: 30 }, 0), 2730); // KKDF + BSMV on top
});

test("minimum-only payoff on ₺33,071.17 costs ₺8,011, as in the main app", () => {
  const t = L.pTerms({ currency: "TRY", terms: { rate: 3.75 } });
  const r = L.pSimulate(3307117, t, { type: "minimum" }, 0);
  assert.equal(r.paidOff, true);
  assert.equal(r.interest, 801102);
  assert.equal(L.pSimulate(3307117, t, { type: "full" }, 0).interest, 0);
  assert.equal(L.pSimulate(3307117, t, { type: "fixed", amount: 500000 }, 0).belowMin, true);
  assert.equal(L.pSimulate(3307117, t, { type: "fixed", amount: 100000 }, 0).paidOff, false);
});

test("all cards: highest real rate first, cheaper than minimums", () => {
  const tr = L.pTerms({ currency: "TRY", terms: { rate: 3.75 } }),
    hi = L.pTerms({ currency: "TRY", terms: { rate: 4.25 } }),
    ua = L.pTerms({ currency: "UAH", terms: { rate: 3.1 } });
  const cards = [
    { id: "ua", balance: 1000000, t: ua, floor: 10000 },
    { id: "zi", balance: 3307117, t: tr, floor: 0 },
    { id: "is", balance: 500000, t: hi, floor: 0 },
  ];
  assert.deepEqual(L.pOrder(cards).map(c => c.id), ["is", "zi", "ua"]);
  const r = L.pSimulateAll(cards, 900000);
  assert.equal(r.paidOff, true);
  assert.equal(r.short, false);
  const mins = cards.reduce((q, c) => q + L.pSimulate(c.balance, c.t, { type: "minimum" }, c.floor).interest, 0);
  assert.ok(r.interest < mins);
  assert.equal(L.pSimulateAll(cards, 300000).short, true);
});

test("Everything I own: groups sum to the total, and the chain lands on net worth and available now", () => {
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
    { id: "g1", name: "Touchable", kind: "gold", mg: 6800, touch: true },
    { id: "g2", name: "Untouchable", kind: "gold", mg: 31103, touch: false },
    { id: "laptop", name: "Laptop", value: 900, currency: "EUR" },
  ];
  const loans = [
    { id: "l1", kind: "lend", name: "Friend", left: 1000, cur: "UAH" },
    { id: "l2", kind: "borrow", name: "Roommate", left: 500, cur: "EUR" },
  ];
  for (const cur of ["TRY", "CZK", "UAH", "USD"]) {
    const w = L.pWorth({ cur, rates, accounts, assets, loans, bills: 1234.56 });
    assert.deepEqual(w.groups.map(g => g.key), ["spendable", "goldTouchable", "goldUntouchable", "investments", "other"]);
    const g = Object.fromEntries(w.groups.map(x => [x.key, x]));
    assert.deepEqual(g.spendable.items.map(i => i.id), ["bank", "wise", "cash", "uah", "icard"]);
    assert.deepEqual(g.other.items.map(i => i.id), ["laptop", "l1"]);
    const cents = n => Math.round(n * 100);
    for (const x of w.groups) assert.equal(cents(x.total), x.items.reduce((q, i) => q + cents(i.value), 0));
    assert.equal(cents(w.total), w.groups.reduce((q, x) => q + cents(x.total), 0));
    let run = 0;
    for (const s of w.chain) {
      if (s.total) {
        if (s.key !== "assets") assert.equal(cents(s.value), cents(run), cur + " " + s.key);
        run = s.value;
      } else run += s.value;
    }
    assert.equal(w.chain.at(-1).value, w.availableNow);
    assert.equal(cents(w.netWorth), cents(w.total - w.cardDebt - w.owe));
    assert.deepEqual(w.missing, []);
  }
  const w = L.pWorth({ cur: "GBP", rates, accounts, assets, loans, bills: 0 });
  assert.ok(w.missing.includes("TRY"));
});

test("recurring: occurrences, next income, and bills waiting before it", () => {
  const rules = [
    { id: "salary", type: "income", amount: 60000, currency: "TRY", day: 1, start: "2026-10" },
    { id: "dorm", type: "expense", amount: 6300, currency: "CZK", day: 20, start: "2026-10" },
    { id: "ai", type: "expense", amount: 20, currency: "USD", day: 28, start: "2026-10" },
    { id: "old", type: "expense", amount: 5, currency: "USD", day: 5, start: "2026-01", end: "2026-06" },
  ];
  const txns = [{ id: "t", rule: "salary", rmonth: "2026-10" }, { id: "u", rule: "dorm", rmonth: "2026-10" }];
  const skips = [];
  assert.equal(L.pNextIncome(rules, txns, skips, "2026-10-25"), "2026-11-01");
  const p = L.pPending(rules, txns, skips, "2026-10-25");
  assert.equal(p.payday, "2026-11-01");
  assert.deepEqual(p.income.map(o => o.rule.id), []);
  assert.deepEqual(p.bills.map(o => o.rule.id + " " + o.date), ["ai 2026-10-28"]);
  // November: salary not confirmed yet on the 2nd → it waits; dorm on the 20th is before the next payday (Dec 1)
  const q = L.pPending(rules, txns, skips, "2026-11-02");
  assert.deepEqual(q.income.map(o => o.date), ["2026-11-01"]);
  assert.deepEqual(q.bills.map(o => o.rule.id + " " + o.date), ["ai 2026-10-28", "dorm 2026-11-20", "ai 2026-11-28"]);
  // a skipped month is done
  const r = L.pPending(rules, txns, [{ rule: "ai", month: "2026-10" }], "2026-10-25");
  assert.deepEqual(r.bills, []);
  // the 31st in a short month falls on its last day
  assert.equal(L.pOccurrences([{ id: "x", type: "expense", day: 31 }], [], [], "2026-02")[0].date, "2026-02-28");
});
