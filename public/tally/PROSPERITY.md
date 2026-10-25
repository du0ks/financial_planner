# Tally + Prosperity (prototype)

[Tally](https://github.com/IamAndelib/Tally-android) (MIT, see `LICENSE-tally.txt`; upstream commit in `UPSTREAM`)
with Prosperity's features added. Plain HTML/CSS/JS, no build step; data stays in this browser (localStorage).

Added, in their own files so Tally's code stays close to upstream:

- `js/p-logic.js` — pure maths: rates and conversion, gold price, "Everything I own" and the chain to net worth and
  available now, recurring income and bills, and monthly budgets.
- `js/p-fx.js` — live rates (fawazahmed0 currency-api) and gold (gold-api.com), cached for offline use.
- `js/p-app.js` — screens and sheets: a Budget tab (a monthly budget per category, spent / to come / left, pace),
  Available now and "To confirm" on Home, grouped Assets with one Gold section and the chain, Liabilities with cards
  and loans, gold in grams, recurring rules in Settings, "Counts as money I can use" per account, each day's rates
  kept with the data, sample data.
- `css/p.css` — styles for those, on Tally's colour roles.

One everyday currency: budgets, totals, the Home ring and the spending summary are all in `settings.cur`; every
entry converts at the rate of its own day (`fxDays`, kept the first time that day is saved, or fetched for an earlier
day). Accounts, gold and recurring rules keep their own currency. Fees count as spending (category Fees).

Changes inside Tally's files: one line each in `index.html` (scripts, stylesheet, CSP `connect-src` for the rate
hosts), `js/main.js` (start rates), `js/state.js` (`pMigrate` keeps the new fields), `js/sheets.js` (a confirmed
recurring entry keeps its link), `js/screens.js` (`drawScreen` takes its tabs from `P_TABS`; Home's ring in the everyday currency and Available now
in place of the per-currency Balance bar), `js/ring.js` (no currency switch), `js/summary.js` (every currency,
converted), `js/state.js` (`isSpend` includes fees; `spentOn` converts) and `js/sheets.js` (`pickMainCur` offers to
move budgets).

Tests for `p-logic.js`: `node --test tally-tests/` from the repository root.
