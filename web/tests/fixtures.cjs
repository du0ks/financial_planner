// A notebook from the previous app ("v5" document) covering every case p-import.js handles. Shared by
// cloud.check.cjs and cloud.e2e.mjs.
const rec = (list, extra = {}) => Object.fromEntries(list.map(r => [r.id, { createdAt: 1, updatedAt: 1, ...extra, ...r }]));
const rates = { USD: "1", TRY: "50", CZK: "20", EUR: "0.9", UAH: "40", XAU: "0.00025" };
function oldDoc() {
  return {
    schema: 5,
    settings: rec([{ id: "displayCurrency", value: "TRY" }, { id: "spendingCurrency", value: "CZK" }]),
    accounts: rec([
      { id: "acct_bank", kind: "bank", name: "Ziraat account", currency: "TRY", available: true, order: 0 },
      { id: "acct_card", kind: "credit", name: "Ziraat", currency: "TRY", available: true, order: 1, monthlyRate: "3.75" },
      { id: "acct_wise", kind: "ewallet", name: "Wise CZK", currency: "CZK", available: true, order: 2 },
      { id: "acct_fund", kind: "investment", name: "Fund", currency: "TRY", available: false, order: 3 },
      { id: "acct_car", kind: "other", name: "Car", currency: "EUR", available: false, order: 4 },
      { id: "acct_gone", kind: "cash", name: "Old", currency: "EUR", deleted: true },
    ]),
    anchors: rec([
      { id: "an1", accountId: "acct_bank", amount: 1000000, date: "2026-10-16", setAt: 100 },
      { id: "an2", accountId: "acct_wise", amount: 0, date: "2026-10-16", setAt: 100 },
      { id: "an3", accountId: "acct_wise", amount: 500000, date: "2026-10-20", setAt: 500 }, // typed again later
      { id: "an4", accountId: "acct_card", amount: -300000, date: "2026-10-16", setAt: 100 },
      { id: "an5", accountId: "acct_fund", amount: 400000, date: "2026-10-16", setAt: 100 },
      { id: "an6", accountId: "acct_car", amount: 800000, date: "2026-10-16", setAt: 100 },
    ]),
    tx: rec([
      { id: "t_before", type: "expense", amount: 624300, currency: "CZK", accountId: "acct_wise", categoryId: "cat_housing", date: "2026-10-01", note: "Dorm" },
      { id: "t_sameday", type: "expense", amount: 1000, currency: "CZK", accountId: "acct_wise", categoryId: "cat_canteen", date: "2026-10-16", note: "", createdAt: 50 }, // before the anchor (same day, earlier)
      { id: "t_after", type: "expense", amount: 15900, currency: "CZK", accountId: "acct_wise", categoryId: "cat_dining", date: "2026-10-19", note: "Lunch", createdAt: 300 },
      { id: "t_usd", type: "expense", amount: 2000, currency: "USD", accountId: "acct_card", categoryId: "cat_subscriptions", date: "2026-10-18", note: "AI", createdAt: 300, ruleId: "rule_ai", ruleMonth: "2026-10" },
      { id: "t_tr", type: "transfer", amount: 500000, currency: "TRY", accountId: "acct_bank", toAccountId: "acct_wise", toAmount: 210000, date: "2026-10-21", note: "To Wise", createdAt: 600 },
      { id: "t_fridge", type: "expense", amount: 340000, currency: "CZK", accountId: null, categoryId: "cat_household", date: "2026-10-15", note: "Fridge", debt: { who: "Gökhan Bey", status: "open", certainty: "possible", direction: "iOwe" } },
      { id: "t_lent", type: "expense", amount: 100000, currency: "TRY", accountId: "acct_bank", categoryId: "cat_other", date: "2026-10-22", note: "Dinner for Ali", createdAt: 700, debt: { who: "Ali", status: "settled", direction: "owedToMe" } },
      { id: "t_back", type: "income", amount: 100000, currency: "TRY", accountId: "acct_bank", categoryId: "cat_other", date: "2026-10-23", note: "", createdAt: 800, settlesTxId: "t_lent" },
      { id: "t_skip", type: "expense", amount: 0, currency: "TRY", accountId: null, categoryId: "cat_subscriptions", date: "2026-09-18", note: "", ruleId: "rule_ai", ruleMonth: "2026-09", skipped: true },
      { id: "t_other", type: "expense", amount: 5000, currency: "EUR", accountId: null, categoryId: "cat_other", date: "2026-10-10", note: "Paid by a friend" },
      { id: "t_del", type: "expense", amount: 999, currency: "CZK", accountId: "acct_wise", categoryId: "cat_other", date: "2026-10-19", deleted: true },
    ]),
    rules: rec([
      { id: "rule_ai", type: "expense", name: "AI", amount: 2000, currency: "USD", accountId: "acct_card", categoryId: "cat_subscriptions", dayOfMonth: 18, startMonth: "2026-09", endMonth: null },
      { id: "rule_salary", type: "income", name: "Salary", amount: 6000000, currency: "TRY", accountId: null, categoryId: "cat_salary", dayOfMonth: 1, startMonth: "2026-11", endMonth: null },
    ]),
    categories: rec([
      { id: "cat_housing", name: "Dorm", icon: "home", order: 0 },
      { id: "cat_canteen", name: "Canteen", icon: "utensils", order: 1 },
      { id: "cat_dining", name: "Dining out", icon: "coffee", order: 2 },
      { id: "cat_subscriptions", name: "AI / subscriptions", icon: "repeat", order: 3 },
      { id: "cat_household", name: "Household", icon: "sofa", order: 4 },
      { id: "cat_other", name: "Other", icon: "dots", order: 5 },
      { id: "cat_salary", name: "Salary", icon: "briefcase", order: 6, income: true },
    ]),
    budgets: rec([
      { id: "b1", categoryId: "cat_canteen", amount: 162500, currency: "CZK" },
      { id: "b2", categoryId: "cat_subscriptions", amount: 150000, currency: "TRY" },
    ]),
    planned: rec([{ id: "p1", name: "Boots" }]),
    portions: rec([{ id: "portion_available", name: "Touchable", available: true }, { id: "portion_longterm", name: "Untouchable", available: false }]),
    goldEvents: rec([
      { id: "g1", type: "buy", mg: 10000, date: "2026-05-17", portionId: "portion_available" },
      { id: "g2", type: "move", mg: 2500, date: "2026-06-01", portionId: "portion_available", toPortionId: "portion_longterm" },
    ]),
    snapshots: {},
    goals: rec([{ id: "goal1", name: "Emergency" }]),
    fxDays: rec([{ id: "2026-10-18", rates: { USD: "1", TRY: "49.5", CZK: "21.5" }, overrides: {} }]),
  };
}

module.exports = { oldDoc, rates };
