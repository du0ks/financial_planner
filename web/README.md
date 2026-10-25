# Prosperity

Personal money across accounts, cards, currencies and gold: one tap per expense, a monthly budget per category, and
one clear number for what you can use. Plain HTML, CSS and JavaScript; no build step.

Copyright © 2026 du0ks. Third-party parts: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Run

```
cd web && python3 -m http.server 8000      # http://localhost:8000
```

## How it adds up

- **One everyday currency** (Settings → Region): budgets, totals, the Home ring and the spending summary are in it.
  Accounts, gold and recurring rules keep their own currency; every entry converts at the rate of its own day
  (`fxDays`: saved the first time that day is used, or fetched for an earlier day).
- **Available now** = money you can use + touchable gold − card debt − loans you owe − bills before your next income.
  **Net worth** = everything you own − card debt − loans you owe. An account counts as money you can use unless its
  "Counts as money I can use" switch is off (savings, a fund, a currency you keep).
- **Budgets**: one monthly amount per spending category; spending at its own day's rate, bills still to come at
  today's. Transfers, loan payments and their fees are never spending.

## On a computer

From 1200px wide there is a side bar (New expense, Money in, Transfer, the tabs, History, Settings) and keyboard
shortcuts: N new expense, I money in, T transfer, 1–4 the tabs, H History, `,` Settings, Enter saves, Esc closes,
? lists them.

## Files

- `js/p-logic.js` — the money maths (rates, gold, the chain, recurring rules, budgets); no DOM, tested by Node.
- `js/p-fx.js` — live and past exchange rates and the gold price (the only network requests).
- `js/p-app.js` — Budget, Assets, Liabilities, gold, recurring rules, sample data.
- the rest of `js/` and `css/` — entries, accounts, loans, History, Settings, sheets, the calculator, the ring.

## Tests

```
node --test web/tests/logic.check.cjs   # the money maths
node web/tests/e2e.mjs            # every screen in a real (headless) Firefox; needs Firefox installed
```
