# Prosperity

Your money across accounts, cards, currencies and gold: one tap per expense, a monthly budget per category, and one
clear number for what you can use. Works on phones and computers, offline too, and keeps each person's data in their
own account. Plain HTML, CSS and JavaScript in `web/`; no build step.

Copyright © 2026 du0ks. Third-party parts: see [web/THIRD_PARTY_NOTICES.md](web/THIRD_PARTY_NOTICES.md).

## Run it

```
cd web && python3 -m http.server 8000      # http://localhost:8000
```

Live at https://prosperity.vogons21.workers.dev. Pushing to `main` makes Cloudflare (Workers, `wrangler.jsonc`) run
the tests and publish `web/`. The old GitHub Pages address only sends people there (`redirect/`, `.github/workflows/pages.yml`).

## How it adds up

- **One everyday currency** (Settings → Region): budgets, totals, the Home ring and the spending summary are in it.
  Accounts, gold and recurring rules keep their own currency; every entry converts at the rate of its own day.
- **Available now** = money you can use + touchable gold − card debt − loans you owe − bills before your next income.
  **Net worth** = everything you own − card debt − loans you owe. An account counts as money you can use unless its
  "Counts as money I can use" switch is off (savings, a fund, a currency you keep).
- **Budgets**: one monthly amount per spending category; spending at its own day's rate, bills still to come at
  today's. Transfers, loan payments and their fees are never spending.

## Accounts and the cloud (Supabase)

- Sign up with email and password (confirmed by email), sign in, reset the password: `web/js/p-cloud.js`, talking to
  Supabase Auth directly. The project's URL and public key are in `web/js/config.js`.
- Each person's notebook is one row of `public.app_state` (`supabase/migrations/`), readable and writable only by them
  (Row Level Security). Every change is saved there within a second, or queued while offline; when two devices change
  it, the two are merged record by record (`web/js/p-sync.js`).
- The first sign-in brings back what the previous app kept (`public.user_data`), with every balance as it was
  (`web/js/p-import.js`).

## Files

- `web/js/p-logic.js` — the money maths (rates, gold, the chain, recurring rules, budgets); no DOM.
- `web/js/p-cloud.js`, `p-sync.js`, `p-import.js` — account, saving and merging, the previous app's data.
- `web/js/p-fx.js` — live and past exchange rates and the gold price.
- `web/js/p-app.js` — Budget, Assets, Liabilities, gold, recurring rules, the computer layout and shortcuts.
- the rest of `web/js/` and `web/css/` — entries, accounts, loans, History, Settings, sheets, the calculator, the ring.

On a computer (1200px+) there is a side bar and keyboard shortcuts: N new expense, I money in, T transfer, 1–4 the
tabs, H History, `,` Settings, Enter saves, Esc closes, ? lists them.

## Tests

```
node --test web/tests/logic.check.cjs web/tests/cloud.check.cjs   # maths, merging, the old app's data
node web/tests/e2e.mjs          # every screen in a real headless Firefox (needs Firefox)
node web/tests/cloud.e2e.mjs    # accounts and sync on two devices, against a stand-in Supabase
```
