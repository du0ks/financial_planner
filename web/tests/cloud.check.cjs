// Tests for web/js/p-sync.js (merging two devices' changes) and web/js/p-import.js (the old app's data).
// Run from the repository root: node --test web/tests/cloud.check.cjs
// With PROSPERITY_BACKUP=/path/to/an-old-app-backup.json it also converts that file and checks every balance.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = (file, names) => new Function(fs.readFileSync(path.join(__dirname, "../js", file), "utf8") + "\nreturn {" + names.join(",") + "};")();
const { pMerge } = load("p-sync.js", ["pMerge"]);
const { pFromV5 } = load("p-import.js", ["pFromV5"]);

/* ---------- merging ---------- */

const nb = (txns, extra = {}) => ({ v: 6, settings: { cur: "CZK" }, accounts: [{ id: "a", name: "Wise" }], types: [], cats: [], txns, loans: [], assets: [], rules: [], skips: [], budgets: {}, fxDays: {}, ...extra });
const t = (id, amount) => ({ id, amount, date: "2026-10-20", type: "expense", account: "a", cat: "food" });
const ids = s => s.txns.map(x => x.id + ":" + x.amount).join(",");

test("adds from both devices are both kept", () => {
  const base = nb([t("x", 1)]);
  const m = pMerge(base, nb([t("x", 1), t("phone", 2)]), nb([t("x", 1), t("laptop", 3)]));
  assert.equal(ids(m), "x:1,phone:2,laptop:3");
});
test("a delete on one device wins over the untouched copy on the other", () => {
  const base = nb([t("x", 1), t("y", 2)]);
  assert.equal(ids(pMerge(base, nb([t("x", 1)]), nb([t("x", 1), t("y", 2), t("z", 3)]))), "x:1,z:3");
  assert.equal(ids(pMerge(base, nb([t("x", 1), t("y", 2), t("w", 4)]), nb([t("y", 2)]))), "y:2,w:4");
});
test("an edit on one device is kept against a delete on the other", () => {
  const base = nb([t("x", 1)]);
  assert.equal(ids(pMerge(base, nb([]), nb([t("x", 5)]))), "x:5");
  assert.equal(ids(pMerge(base, nb([t("x", 7)]), nb([]))), "x:7");
});
test("changed on one side takes that side; on both, this device", () => {
  const base = nb([t("x", 1), t("y", 1)]);
  assert.equal(ids(pMerge(base, nb([t("x", 1), t("y", 9)]), nb([t("x", 8), t("y", 1)]))), "x:8,y:9");
  assert.equal(ids(pMerge(base, nb([t("x", 2), t("y", 1)]), nb([t("x", 3), t("y", 1)]))), "x:2,y:1");
});
test("maps (budgets, settings, rates) merge key by key; skips by rule and month", () => {
  const base = nb([], { budgets: { food: { amount: 1 } }, settings: { cur: "CZK", week: 1 }, skips: [{ rule: "r", month: "2026-10" }] });
  const local = nb([], { budgets: { food: { amount: 1 }, rent: { amount: 5 } }, settings: { cur: "CZK", week: 0 }, skips: [] });
  const remote = nb([], { budgets: {}, settings: { cur: "UAH", week: 1 }, skips: [{ rule: "r", month: "2026-10" }, { rule: "r", month: "2026-11" }] });
  const m = pMerge(base, local, remote);
  assert.deepEqual(m.budgets, { rent: { amount: 5 } }); // food deleted remotely, rent added here
  assert.deepEqual(m.settings, { cur: "UAH", week: 0 });
  assert.deepEqual(m.skips, [{ rule: "r", month: "2026-11" }]);
});
test("the first sync on a device (no base) keeps everything from both, the cloud's version where they differ", () => {
  assert.equal(ids(pMerge(null, nb([t("x", 1)]), nb([t("y", 2)]))), "x:1,y:2");
  // a device that started blank (offline at sign-in) mustn't reset the everyday currency or renamed categories
  const m = pMerge(null, nb([t("new", 4)], { settings: { cur: "USD" }, cats: [{ id: "housing", name: "Housing" }] }), nb([t("x", 1)], { settings: { cur: "CZK" }, cats: [{ id: "housing", name: "Dorm" }] }));
  assert.equal(ids(m), "new:4,x:1");
  assert.equal(m.settings.cur, "CZK");
  assert.equal(m.cats[0].name, "Dorm");
});

/* ---------- the old app's data ---------- */

const { oldDoc, rates } = require("./fixtures.cjs");

test("every balance comes over exactly as the old app showed it", () => {
  const { state, report } = pFromV5(oldDoc(), { latest: rates, today: "2026-10-25" });
  const by = Object.fromEntries(report.accounts.map(a => [a.name, a]));
  for (const a of report.accounts) assert.equal(a.same, true, a.name + ": " + a.before + " → " + a.after);
  assert.equal(by["Ziraat account"].after, 10000 - 5000 - 1000 + 1000); // anchor, transfer out, lent, got back
  assert.equal(by["Wise CZK"].after, 5000 + 2100); // typed 5,000 on the 20th, then the transfer came in
  assert.equal(by.Ziraat.after, -3000 - 990); // card: anchor, then $20 at that day's 49.5
  assert.equal(by.Fund.after, 4000);
  assert.ok(!report.accounts.some(a => a.name === "Old")); // deleted in the old app
  // the second typed balance became a balance fix on its day
  assert.ok(state.txns.some(x => x.type === "adjust" && x.date === "2026-10-20" && x.account === "acct-wise"));
});
test("accounts, types, ids and what counts as money you can use", () => {
  const { state } = pFromV5(oldDoc(), { latest: rates, today: "2026-10-25" });
  assert.deepEqual(state.accounts.map(a => a.id + ":" + a.type + (a.avail === false ? ":kept" : "")), ["acct-bank:bank", "acct-card:card", "acct-wise:wallet", "acct-fund:savings:kept"]);
  assert.ok(state.txns.every(x => /^[A-Za-z0-9-]+$/.test(x.id) && /^[A-Za-z0-9-]+$/.test(x.account)));
  assert.equal(state.settings.cur, "CZK"); // the spending currency is the everyday one
  assert.deepEqual(state.assets.find(x => x.id === "acct-car"), { id: "acct-car", name: "Car", value: 8000, currency: "EUR", i: "diamond", c: "#a646c9" });
});
test("someone else paid: a loan from them, and the spending counted", () => {
  const { state, report } = pFromV5(oldDoc(), { latest: rates, today: "2026-10-25" });
  const loan = state.loans.find(l => l.kind === "borrow");
  assert.equal(loan.person, "Gökhan Bey");
  const draw = state.txns.find(x => x.loan === loan.id && x.principal);
  assert.deepEqual([draw.account, draw.amount, draw.dir], ["acct-wise", 3400, "in"]);
  assert.ok(state.txns.some(x => x.type === "expense" && x.amount === 3400 && x.account === "acct-wise" && x.note === "Fridge"));
  assert.equal(report.loans.length, 2);
  // you paid for Ali and got it back: money lent and repaid, not spending
  const lend = state.loans.find(l => l.kind === "lend");
  assert.deepEqual(state.txns.filter(x => x.loan === lend.id).map(x => x.dir + ":" + x.amount + (x.principal ? ":draw" : "")), ["out:1000:draw", "in:1000"]);
  assert.ok(!state.txns.some(x => x.type === "income" && x.amount === 1000));
  // paid by a friend with no debt: nothing moved in your accounts
  assert.match(report.skipped[0], /Paid by a friend/);
});
test("recurring, skips, budgets, categories, gold and rates", () => {
  const { state, report } = pFromV5(oldDoc(), { latest: rates, today: "2026-10-25" });
  assert.deepEqual(state.rules.map(r => r.name + ":" + r.account + ":" + r.cat + ":" + r.amount + r.currency), ["AI:acct-card:bills:20USD", "Salary:acct-bank:income:60000TRY"]);
  assert.deepEqual(state.skips, [{ rule: "rule-ai", month: "2026-09" }]);
  assert.ok(state.txns.some(x => x.rule === "rule-ai" && x.rmonth === "2026-10" && x.amount === 990));
  assert.deepEqual(state.budgets, { "cat-canteen": { amount: 1625, currency: "CZK" }, bills: { amount: 1500, currency: "TRY" } });
  assert.deepEqual(state.pCats.map(c => c.id + (c.rename ? "=" + c.rename : "")), ["housing=Dorm", "cat-canteen", "food=Dining out", "bills=AI / subscriptions", "cat-household", "other=Other", "income=Salary"]);
  assert.deepEqual(state.assets.filter(x => x.kind === "gold").map(x => x.name + ":" + x.mg + ":" + x.touch), ["Touchable:7500:true", "Untouchable:2500:false"]);
  assert.equal(state.fxDays["2026-10-18"].TRY, 49.5);
  assert.deepEqual(report.left, ["1 planned purchase", "1 goal", "card interest settings (1)"]);
});

const real = process.env.PROSPERITY_BACKUP;
test("a real backup converts with every balance the same", { skip: !real || !fs.existsSync(real) }, () => {
  const doc = JSON.parse(fs.readFileSync(real, "utf8")).doc;
  const { report } = pFromV5(doc, { latest: {}, today: "2026-10-25" });
  for (const a of report.accounts) assert.equal(a.same, true, a.name);
  assert.ok(report.counts.entries > 0);
});
