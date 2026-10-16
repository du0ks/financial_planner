# Prosperity

Personal finances across accounts, cards, currencies and gold. A React PWA on GitHub Pages,
with each user's data in one Supabase row.

## Run

```
npm install
npm run dev      # http://localhost:5173/financial_planner/  (log in with demo / demo)
npm test         # vitest: money, FX, gold, card interest, payoff, insights, sync
npm run lint
npm run build
```

`.env` (optional locally, see `.env.example`) holds the public Supabase URL and anon key.
Security comes from Row Level Security on `public.user_data`, not from hiding that key.

## How the data works

- **One document per user** (`src/lib/doc.js`): collections of records (accounts, anchors,
  tx, rules, categories, budgets, planned, portions, goldEvents, snapshots, goals, fxDays,
  settings). Each record carries `updatedAt`; deletes are tombstones.
- **Money is exact**: integer minor units per currency, rates and percentages through
  big.js (`src/lib/money.js`, `src/lib/fx.js`). Gold is integer milligrams.
- **Every item has its own currency.** Totals convert into the display currency. Balances
  convert at today's rate; transactions at the frozen rate of their own date (`fxDays`),
  so past months never move. Manual pair overrides live in settings.
- **Balances** are the last value you typed (an anchor) plus every transaction after it
  (`src/lib/ledger.js`). A credit card is an account with a negative balance; paying it is
  a transfer. Transfers are never spending or income.
- **Recurring income and bills** are rules; each month's occurrence waits to be confirmed.
- **Card interest** (`src/lib/cards.js`) follows each card's own terms. The Turkey preset
  charges interest only on the unpaid remainder once the minimum is paid, plus KKDF + BSMV,
  and late interest on any unpaid part of the minimum. The Generic preset has no taxes and
  lets the card charge either the remainder or the whole statement.
- **Sync** (`src/state/store.js`): local first. A save is a compare-and-swap on the row's
  `updated_at`; if another device saved first, the documents merge record by record and
  the merge is saved. Offline edits stay on the device and go up when the connection is back.
- Data from before v5 is not carried over. The old columns (`cards`, `funds`, `others`,
  `history`, `gold_grams`) are written empty on every save; old localStorage keys are
  removed on start.

## Market data

- Rates and gold history: [fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api)
  (daily, every ISO currency plus XAU, history by date).
- Live gold: gold-api.com XAU/USD. Gold is valued at spot, converted at today's rate; %
  changes compare the gram price in the display currency with the same day back then.

## Text

All UI text is in `src/i18n/strings.js`.
