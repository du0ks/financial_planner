# Tally + Prosperity (prototype)

[Tally](https://github.com/IamAndelib/Tally-android) (MIT, see `LICENSE-tally.txt`; upstream commit in `UPSTREAM`)
with Prosperity's features added. Plain HTML/CSS/JS, no build step; data stays in this browser (localStorage).

Added, in their own files so Tally's code stays close to upstream:

- `js/p-logic.js` — pure maths: rates and conversion, gold price, card interest (Turkey / Generic) and payoff,
  "Everything I own" and the chain to net worth and available now, recurring income and bills.
- `js/p-fx.js` — live rates (fawazahmed0 currency-api) and gold (gold-api.com), cached for offline use.
- `js/p-app.js` — screens and sheets: Available now and "To confirm" on Home, grouped Assets with the chain,
  Liabilities with card interest and an all-cards payoff plan, gold in grams, interest rules per card, recurring
  rules in Settings, "Counts as money I can use" per account, sample data.
- `css/p.css` — styles for those, on Tally's colour roles.

Changes inside Tally's files: one line each in `index.html` (scripts, stylesheet, CSP `connect-src` for the rate
hosts), `js/main.js` (start rates), `js/state.js` (`pMigrate` keeps the new fields), `js/sheets.js` (a confirmed
recurring entry keeps its link).

Tests for `p-logic.js`: `node --test tally-tests/` from the repository root.
