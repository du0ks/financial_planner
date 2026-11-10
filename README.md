# Prosperity

A personal finance web app that tracks money across accounts, cards, currencies and gold, and gives one number for what you can actually spend.

Live: https://prosperity.vogons21.workers.dev (there is a "Try it with sample data" button on the start screen).

Copyright © 2026 du0ks. Third-party parts: see [web/THIRD_PARTY_NOTICES.md](web/THIRD_PARTY_NOTICES.md).

## Why I built it

I keep money in more than one currency, on credit cards, and partly in gold. Most budgeting apps assume one currency and one bank. I wanted to log an expense in one tap, set a monthly budget per category, and see one honest figure for what is available today, with every amount converted at the rate of the day it happened.

## How it works

- **One everyday currency.** Budgets, totals, the Home ring and the spending summary use it. Accounts, gold and recurring rules keep their own currency. Each entry converts at the exchange rate of its own day; those rates are stored with the data.
- **Available now** = money you can use + gold you count as usable − card debt − loans you owe. Bills are taken off only once they are paid. Any account can be switched out of "money I can use" (savings, a fund, a currency you hold).
- **Net worth** = everything you own − card debt − loans you owe.
- **Budgets**: one monthly amount per category. Transfers, loan payments and their fees never count as spending.
- **Gold** is tracked in grams and valued from a live spot price.
- **Recurring income and bills**, loans you owe or lent, a calculator in the amount field, CSV export and JSON backup/restore.
- **Exchange rates** come from the fawazahmed0 currency API (daily rates for all currencies, with a fallback mirror) and gold-api.com (live gold spot). They refresh every 15 minutes and are cached on the device for offline use. These are the only third-party hosts the app's Content-Security-Policy allows.
- **Offline and installable**: a service worker serves the app's files from cache, and there is a web app manifest.
- **Desktop layout** (1200px and wider): a side bar and keyboard shortcuts. N new expense, I money in, T transfer, 1–4 tabs, H History, `,` Settings, ? lists them.

### Accounts and sync

- Sign up with email and password (confirmed by email), sign in and reset the password. `web/js/p-cloud.js` calls Supabase Auth over plain `fetch`, without the Supabase SDK.
- Each person's data is one JSON row in `public.app_state`, protected by Row Level Security so users can only read and write their own row. Saves use the row's revision number, so a write only goes through if nobody else has saved since.
- Changes are saved within about a second, or queued while offline.
- When two devices or two windows change the same data, `web/js/p-sync.js` merges them record by record against the last synced copy. An edit wins over a delete on the other side, so nothing disappears silently. A device's first sync can't overwrite settings or categories with blank defaults.
- A database trigger keeps earlier versions of each person's data (last 30 days, up to 500 versions) in `public.app_state_history` (`supabase/migrations/`).
- The first sign-in imports data from the previous version of the app (`web/js/p-import.js`) and recalculates opening balances so each account ends at exactly the balance it had before.

The Supabase URL and anon key in `web/js/config.js` are public by design; access control is done by Row Level Security.

## Tech stack

- Plain HTML, CSS and JavaScript in `web/`. No framework, no build step.
- Supabase (Auth + Postgres with RLS) for accounts and storage.
- Cloudflare Workers static assets for hosting (`wrangler.jsonc` points at `web/`).
- Tests: Node's built-in test runner, plus end-to-end tests that drive headless Firefox over WebDriver BiDi using Node 22's built-in WebSocket client (no test dependencies to install).

The screens, styles and data handling started from [Tally](https://github.com/IamAndelib/Tally-android) (MIT). The `p-*.js` files (money maths, rates, budgets, gold, cloud sync, merging, import) and `p.css` are my additions on top of it.

## Run it locally

```
cd web && python3 -m http.server 8000      # http://localhost:8000
```

Any static file server works. Without signing in you can use "Try it with sample data".

## Tests

Run from the repository root:

```
node --test web/tests/logic.check.cjs web/tests/cloud.check.cjs   # money maths, merging, import of old data
node web/tests/e2e.mjs          # every screen in headless Firefox (needs Node 22+ and Firefox)
node web/tests/cloud.e2e.mjs    # sign-up, sync and merging across two browser windows, against a fake Supabase
```

## Project structure

```
web/
  index.html, sw.js, manifest.webmanifest
  js/p-logic.js     money maths: rates, gold, net worth / available now, recurring rules, budgets (no DOM)
  js/p-fx.js        live and historical exchange rates, gold price
  js/p-cloud.js     auth, saving, offline queue
  js/p-sync.js      record-by-record merge (pure, tested in Node)
  js/p-import.js    import from the previous app version
  js/p-app.js       Budget, Assets, Liabilities, gold, recurring rules, desktop layout and shortcuts
  js/*.js, css/     entries, accounts, loans, history, settings, sheets, calculator, ring (from Tally, adapted)
  tests/            unit and end-to-end tests
supabase/migrations/  app_state table, RLS policies, version history trigger
redirect/             old GitHub Pages address, now redirects to the live site
```

## Deployment

Cloudflare serves `web/` as static files (`wrangler.jsonc`). The old GitHub Pages site is kept only as a redirect: `.github/workflows/pages.yml` publishes `redirect/`, which sends every old link to the new address.
