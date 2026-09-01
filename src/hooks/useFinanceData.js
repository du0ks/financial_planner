import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useLocalStorage from './useLocalStorage';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../utils/supabase';
import { snapshotCashNet } from '../utils/snapshots';

const DEFAULT_CARD_FIELDS = {
    interestRate: 0,
    statementDay: 31,
    paymentDueDays: 8,
    minimumPayment: 0,
    currency: 'TRY'
};

const DEFAULT_FUND_CURRENCY = 'TRY';

const DEFAULT_OTHER_FIELDS = {
    currency: 'TRY',
    isRecurring: true,
    recurrenceDay: 1,
    category: 'other',
    endDate: null
};

const DEFAULT_DATA = {
    cards: [
        { id: 1, name: 'Card A (Main Card)', limit: 15000, money: 2000, debt: 3500, ...DEFAULT_CARD_FIELDS },
        { id: 2, name: 'Card B (Backup)', limit: 5000, money: 0, debt: 0, ...DEFAULT_CARD_FIELDS },
    ],
    funds: [
        { id: 101, name: 'Salary Account', amount: 8500, currency: DEFAULT_FUND_CURRENCY },
        { id: 102, name: 'Savings Account', amount: 12000, currency: DEFAULT_FUND_CURRENCY },
        { id: 103, name: 'Wallet / Cash', amount: 450, currency: DEFAULT_FUND_CURRENCY }
    ],
    others: [
        { id: 201, name: 'Rent', amount: 0, ...DEFAULT_OTHER_FIELDS, category: 'housing' },
        { id: 202, name: 'Dorm / Tuition', amount: 0, ...DEFAULT_OTHER_FIELDS }
    ]
};

const INVESTMENT_NAMES = {
    gold: 'Gold Reserves',
    euro: 'Euro Holdings',
    usd: 'USD Holdings',
    custom: 'Custom Investment'
};

const IDENTITY_RATES = { TRY: 1, UAH: 1, EUR: 1, USD: 1 };

const numericValue = (value) => parseFloat(value) || 0;
const clampDay = (value, fallback) => Math.min(31, Math.max(1, numericValue(value) || fallback));

// An item saved before per-item currency existed holds an amount that was typed under
// whatever display currency was selected at the time — so the fallback must be that
// currency, never a hardcoded 'TRY'. Passing a wrong fallback silently misconverts real
// money, which is exactly the bug these parameters exist to prevent.
const normalizeCards = (items, fallbackCurrency = DEFAULT_CARD_FIELDS.currency) => (
    Array.isArray(items)
        ? items.map(card => ({
            ...DEFAULT_CARD_FIELDS,
            ...card,
            statementDay: clampDay(card?.statementDay, DEFAULT_CARD_FIELDS.statementDay),
            paymentDueDays: Math.max(0, numericValue(card?.paymentDueDays ?? DEFAULT_CARD_FIELDS.paymentDueDays)),
            currency: card?.currency || fallbackCurrency
        }))
        : DEFAULT_DATA.cards
);

const normalizeFunds = (items, fallbackCurrency = DEFAULT_FUND_CURRENCY) => (
    Array.isArray(items)
        ? items.map(fund => ({
            ...fund,
            currency: fund?.currency || fallbackCurrency
        }))
        : DEFAULT_DATA.funds
);

const normalizeOthers = (items, fallbackCurrency = DEFAULT_OTHER_FIELDS.currency) => (
    Array.isArray(items)
        ? items.map(other => ({
            ...DEFAULT_OTHER_FIELDS,
            ...other,
            recurrenceDay: clampDay(other?.recurrenceDay, DEFAULT_OTHER_FIELDS.recurrenceDay),
            currency: other?.currency || fallbackCurrency,
            endDate: other?.endDate || null
        }))
        : DEFAULT_DATA.others
);

// True when any item still predates per-item currency, so the one-off stamping effects
// below know to run (and, once stamped, to stop).
const needsCurrencyStamp = (items) => Array.isArray(items) && items.some(item => item && !item.currency);

const createGoldInvestment = (amount = 0) => ({
    id: generateUUID(),
    type: 'gold',
    name: INVESTMENT_NAMES.gold,
    amount: numericValue(amount)
});

const normalizeInvestments = (items, legacyGoldGrams = 0) => {
    if (!Array.isArray(items)) {
        return numericValue(legacyGoldGrams) > 0 ? [createGoldInvestment(legacyGoldGrams)] : [];
    }

    return items
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id || generateUUID(),
            type: ['gold', 'euro', 'usd', 'custom'].includes(item.type) ? item.type : 'custom',
            name: item.name || INVESTMENT_NAMES[item.type] || INVESTMENT_NAMES.custom,
            amount: numericValue(item.amount)
        }));
};

const normalizeIncomes = (items) => (
    Array.isArray(items)
        ? items
            .filter(item => item && typeof item === 'object')
            .map(income => ({
                id: income.id || generateUUID(),
                name: income.name || 'Income',
                amount: numericValue(income.amount),
                currency: income.currency || 'TRY',
                date: income.date || new Date().toISOString().split('T')[0],
                isRecurring: Boolean(income.isRecurring),
                recurrenceDay: income.isRecurring ? clampDay(income.recurrenceDay, 1) : null,
                endDate: income.endDate || null
            }))
        : []
);

const normalizeEvents = (items) => (
    Array.isArray(items)
        ? items
            .filter(item => item && typeof item === 'object')
            .map(event => ({
                id: event.id || generateUUID(),
                name: event.name || 'Future Event',
                date: event.date || new Date().toISOString().split('T')[0],
                type: ['milestone', 'expense', 'income', 'lock'].includes(event.type) ? event.type : 'milestone',
                amount: numericValue(event.amount)
            }))
        : []
);

const isStillActive = (endDate) => !endDate || new Date(`${endDate}T23:59:59`) >= new Date();

// When this browser last accepted a real user edit. Compared against the cloud row's
// updated_at so a stale cloud record can't overwrite work that never made it up.
const TOUCH_SUFFIX = 'touched_at_v1';

const readLocalEditStamp = (prefix) => {
    try {
        return Number(window.localStorage.getItem(`${prefix}${TOUCH_SUFFIX}`)) || 0;
    } catch (error) {
        console.error(error);
        return 0;
    }
};

// One-time migration. The stamp key is new, so it reads as 0 everywhere — which would hand
// the first reconciliation to the cloud and wipe browsers holding edits that never pushed
// (every push has been failing, see the extended_data note in pushToCloud). A browser that
// already has local data therefore gets stamped "now" and wins once. A genuinely new device
// has no local data, leaves the key unset, and correctly lets the cloud win.
const seedLocalEditStamp = (prefix) => {
    try {
        const stampKey = `${prefix}${TOUCH_SUFFIX}`;
        if (!window.localStorage.getItem(stampKey) && window.localStorage.getItem(`${prefix}cards_v3`)) {
            window.localStorage.setItem(stampKey, String(Date.now()));
        }
    } catch (error) {
        console.error(error);
    }
};

export default function useFinanceData(session) {
    const prefix = session?.isDemo ? 'demo_' : 'finance_';

    const [rawCards, setCards] = useLocalStorage(`${prefix}cards_v3`, DEFAULT_DATA.cards);
    const [rawFunds, setFunds] = useLocalStorage(`${prefix}funds_v3`, DEFAULT_DATA.funds);
    const [rawOthers, setOthers] = useLocalStorage(`${prefix}others_v3`, DEFAULT_DATA.others);
    const [currency, setCurrency] = useLocalStorage(`${prefix}currency_v3`, 'TRY');
    const [history, setHistory] = useLocalStorage(`${prefix}history_v3`, []);
    const [legacyGoldGrams, setLegacyGoldGrams] = useLocalStorage(`${prefix}gold_v3`, 0);
    const [rawInvestments, setInvestments] = useLocalStorage(`${prefix}investments_v3`, null);
    const [rawIncomes, setIncomes] = useLocalStorage(`${prefix}incomes_v3`, []);
    const [rawEvents, setEvents] = useLocalStorage(`${prefix}events_v3`, []);
    const [goldPrice, setGoldPrice] = useState(0); // USD per gram
    const [goldChanges, setGoldChanges] = useState({ d1: 0, w1: 0, m1: 0, y1: 0 });
    // Market rates are not user data: they live under a bare key so they survive a switch
    // between the demo and real accounts. null means "never successfully fetched".
    const [storedFx, setStoredFx] = useLocalStorage('fx_rates_v1', null);

    const userId = session?.user?.id || null;
    const isDemo = Boolean(session?.isDemo);

    // Sync status, surfaced in Settings and the header. A failed save used to be nothing but
    // a console.error, which is how "nothing is being saved" went unnoticed for days.
    const [syncState, setSyncState] = useState('idle'); // idle | loading | saving | ready | error
    const [syncError, setSyncError] = useState(null);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    // Flipped once, after the cloud row has been read. Pushing before that would send this
    // browser's starting defaults over good cloud data.
    const [hydrated, setHydrated] = useState(false);
    const hydratedFor = useRef(null);

    const markLocalEdit = useCallback(() => {
        try {
            window.localStorage.setItem(`${prefix}${TOUCH_SUFFIX}`, String(Date.now()));
        } catch (error) {
            console.error(error);
        }
    }, [prefix]);

    // Only real user edits bump the stamp. Cloud hydration and the currency-stamping
    // migrations below deliberately use the raw setters — if they stamped too, this browser
    // would always look newer than the cloud and cross-device sync would never work.
    const asUserEdit = (setter) => (value) => {
        markLocalEdit();
        setter(value);
    };
    const setCardsEdited = asUserEdit(setCards);
    const setFundsEdited = asUserEdit(setFunds);
    const setOthersEdited = asUserEdit(setOthers);
    const setInvestmentsEdited = asUserEdit(setInvestments);
    const setIncomesEdited = asUserEdit(setIncomes);
    const setEventsEdited = asUserEdit(setEvents);
    const setHistoryEdited = asUserEdit(setHistory);
    const setCurrencyEdited = asUserEdit(setCurrency);
    const setLegacyGoldGramsEdited = asUserEdit(setLegacyGoldGrams);

    const ratesReady = Boolean(storedFx?.rates);
    const ratesFetchedAt = storedFx?.fetchedAt || null;
    // Identity rates are the only sane arithmetic fallback, but they quietly treat every
    // currency as equal — so anything user-facing must gate on ratesReady, not on this.
    const exchangeRates = storedFx?.rates || IDENTITY_RATES;

    const cards = normalizeCards(rawCards, currency);
    const funds = normalizeFunds(rawFunds, currency);
    const others = normalizeOthers(rawOthers, currency);
    const investments = normalizeInvestments(rawInvestments, legacyGoldGrams);
    const incomes = normalizeIncomes(rawIncomes);
    const events = normalizeEvents(rawEvents);
    const historyList = useMemo(() => Array.isArray(history) ? history : [], [history]);

    // Move the legacy gold scalar into the investments collection once the new key exists.
    useEffect(() => {
        if (!Array.isArray(rawInvestments)) {
            setInvestments(normalizeInvestments(rawInvestments, legacyGoldGrams));
        }
    }, [rawInvestments, legacyGoldGrams, setInvestments]);

    // Stamp pre-currency cards/funds/bills with the display currency they were typed under,
    // once, then stop. Keyed on the RAW arrays: the normalized ones are rebuilt every render,
    // so depending on them would loop forever. The needsCurrencyStamp guard is what makes
    // this self-terminating.
    useEffect(() => {
        if (needsCurrencyStamp(rawCards)) setCards(normalizeCards(rawCards, currency));
    }, [rawCards, currency, setCards]);

    useEffect(() => {
        if (needsCurrencyStamp(rawFunds)) setFunds(normalizeFunds(rawFunds, currency));
    }, [rawFunds, currency, setFunds]);

    useEffect(() => {
        if (needsCurrencyStamp(rawOthers)) setOthers(normalizeOthers(rawOthers, currency));
    }, [rawOthers, currency, setOthers]);

    // Keep the legacy storage/cloud field coherent for older clients and backups.
    useEffect(() => {
        if (!Array.isArray(rawInvestments)) return;
        const storedGold = numericValue(rawInvestments.find(item => item?.type === 'gold')?.amount);
        if (storedGold !== numericValue(legacyGoldGrams)) {
            setLegacyGoldGrams(storedGold);
        }
    }, [rawInvestments, legacyGoldGrams, setLegacyGoldGrams]);

    // Hydrate from Supabase once per signed-in user.
    //
    // This used to be keyed on the whole `session` object, and App.jsx replaces that object
    // on every auth event supabase-js emits — INITIAL_SESSION at startup, SIGNED_IN when the
    // tab regains visibility, TOKEN_REFRESHED on a timer. Each one re-ran this fetch and
    // blindly overwrote local state (and, through useLocalStorage, localStorage) with the
    // cloud row. That is what made freshly typed numbers disappear on returning to a tab.
    useEffect(() => {
        if (!userId || isDemo) {
            // Demo and signed-out both stay local-only. Clearing the marker means signing
            // back into a real account still hydrates.
            hydratedFor.current = null;
            setSyncState('idle');
            setHydrated(true);
            return;
        }
        if (hydratedFor.current === userId) return;
        hydratedFor.current = userId;

        setHydrated(false);
        seedLocalEditStamp(prefix);
        setSyncState('loading');

        const fetchData = async () => {
            const { data, error } = await supabase
                .from('user_data')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (data && !error) {
                const cloudUpdatedAt = Date.parse(data.updated_at) || 0;
                const localTouchedAt = readLocalEditStamp(prefix);

                if (cloudUpdatedAt >= localTouchedAt) {
                    const extendedData = data.extended_data || {};

                    // Cloud wins, while old records receive new defaults. The cloud amounts
                    // were typed under the cloud record's currency, so that — not the local
                    // currency state — is the right fallback for unstamped rows.
                    const cloudCurrency = data.currency || 'TRY';
                    setCards(normalizeCards(data.cards, cloudCurrency));
                    setFunds(normalizeFunds(data.funds, cloudCurrency));
                    setOthers(normalizeOthers(data.others, cloudCurrency));
                    setCurrency(cloudCurrency);
                    setHistory(Array.isArray(data.history) ? data.history : []);
                    setLegacyGoldGrams(data.gold_grams || 0);
                    setInvestments(normalizeInvestments(extendedData.investments, data.gold_grams));
                    setIncomes(normalizeIncomes(extendedData.incomes));
                    setEvents(normalizeEvents(extendedData.events));
                    console.log('Cloud sync complete: data loaded from Supabase');
                } else {
                    // Edits made here are newer than anything in the cloud — most likely they
                    // never pushed. Keep them; the debounced push below sends them up.
                    console.log('Cloud sync: local edits are newer than the cloud record, keeping local');
                }

                setSyncError(null);
                setLastSyncedAt(Date.now());
                setSyncState('ready');
            } else if (error && error.code === 'PGRST116') {
                // No row for this user yet — seed it from local.
                await pushToCloud();
                console.log('Cloud initialized: local data pushed to Supabase');
            } else if (error) {
                // Offline or a real failure. Local stays authoritative and the push below is
                // still allowed to retry, so a transient outage doesn't stop saving.
                console.error('Cloud sync failed:', error);
                setSyncError(error.message || 'Could not reach the cloud');
                setSyncState('error');
            }

            setHydrated(true);
        };

        fetchData();
    // The setters are stable; pushToCloud is intentionally read from this render's closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, isDemo, prefix]);

    // Fetch Market Data (Gold & FX)
    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                // Fetch Gold Price (XAU/USD)
                // Note: The API returns price per Troy Ounce (31.1035g)
                const goldRes = await fetch('https://api.gold-api.com/price/XAU');
                const goldData = await goldRes.json();
                if (goldData.price) {
                    setGoldPrice(goldData.price / 31.1035);
                }

                // Fetch FX Rates
                const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const fxData = await fxRes.json();
                // Only store a complete, numeric set — a partial response would leave some
                // currency silently converting at 1:1.
                const fetched = fxData?.rates;
                if (fetched && [fetched.TRY, fetched.UAH, fetched.EUR].every(Number.isFinite)) {
                    setStoredFx({
                        rates: { TRY: fetched.TRY, UAH: fetched.UAH, EUR: fetched.EUR, USD: 1 },
                        fetchedAt: Date.now()
                    });
                }

                // Fetch Gold Performance Percentages (using PAXG as proxy for XAU)
                const perfRes = await fetch('https://api.coingecko.com/api/v3/coins/pax-gold?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
                const perfData = await perfRes.json();
                if (perfData.market_data) {
                    setGoldChanges({
                        d1: perfData.market_data.price_change_percentage_24h || 0,
                        w1: perfData.market_data.price_change_percentage_7d || 0,
                        m1: perfData.market_data.price_change_percentage_30d || 0,
                        y1: perfData.market_data.price_change_percentage_1y || 0
                    });
                }
            } catch (err) {
                console.error("Market data fetch failed:", err);
            }
        };

        fetchMarketData();
        const interval = setInterval(fetchMarketData, 1000 * 60 * 15); // Refresh every 15 mins
        return () => clearInterval(interval);
    }, []);

    const convertCurrencyAmount = useCallback((amount, sourceCurrency = currency) => {
        const sourceRate = exchangeRates[sourceCurrency] || 1;
        const displayRate = exchangeRates[currency] || 1;
        return numericValue(amount) * (displayRate / sourceRate);
    }, [currency, exchangeRates]);

    const primaryGold = investments.find(investment => investment.type === 'gold');
    const goldGrams = numericValue(primaryGold?.amount);
    const goldPricePerGram = goldPrice * (exchangeRates[currency] || 1);
    const goldValue = goldGrams * goldPricePerGram;

    const getInvestmentValue = useCallback((investment) => {
        if (investment.type === 'gold') return numericValue(investment.amount) * goldPricePerGram;
        if (investment.type === 'euro') return convertCurrencyAmount(investment.amount, 'EUR');
        if (investment.type === 'usd') return convertCurrencyAmount(investment.amount, 'USD');
        return numericValue(investment.amount);
    }, [convertCurrencyAmount, goldPricePerGram]);

    // Push to Supabase on changes (throttled)
    // NOTE: `extended_data` must exist as a jsonb column on public.user_data. Postgres rejects
    // the whole upsert if any field in the payload has no column, so a missing column here
    // means nothing saves at all — not just investments/incomes/events. That is exactly what
    // happened after the redesign added this field. The fix is:
    //   alter table public.user_data add column if not exists extended_data jsonb default '{}'::jsonb;
    const pushToCloud = useCallback(async () => {
        if (!userId || isDemo) return;

        const normalizedInvestments = normalizeInvestments(rawInvestments, legacyGoldGrams);
        const legacyGold = numericValue(normalizedInvestments.find(item => item.type === 'gold')?.amount);
        const payload = {
            user_id: userId,
            cards: normalizeCards(rawCards, currency),
            funds: normalizeFunds(rawFunds, currency),
            others: normalizeOthers(rawOthers, currency),
            currency,
            history: historyList,
            gold_grams: legacyGold,
            extended_data: {
                investments: normalizedInvestments,
                incomes: normalizeIncomes(rawIncomes),
                events: normalizeEvents(rawEvents),
                version: 2
            },
            updated_at: new Date().toISOString()
        };

        setSyncState('saving');

        const { error } = await supabase
            .from('user_data')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            console.error('Cloud push failed:', error);
            setSyncError(error.message || 'Could not save to the cloud');
            setSyncState('error');
            return;
        }

        setSyncError(null);
        setLastSyncedAt(Date.now());
        setSyncState('ready');
    }, [userId, isDemo, rawCards, rawFunds, rawOthers, currency, historyList, rawInvestments, rawIncomes, rawEvents, legacyGoldGrams]);

    // Track changes and push. `hydrated` gates it so the first push can never land before the
    // cloud row has been read. syncState is deliberately NOT a dependency — it changes on
    // every push, and depending on it would reschedule the timer forever.
    useEffect(() => {
        if (!userId || isDemo || !hydrated) return undefined;

        const timer = setTimeout(() => {
            pushToCloud();
        }, 1200); // sits just behind the ~1s field auto-commit

        return () => clearTimeout(timer);
    }, [userId, isDemo, hydrated, rawCards, rawFunds, rawOthers, currency, historyList, rawInvestments, rawIncomes, rawEvents, legacyGoldGrams, pushToCloud]);

    const toggleCurrency = () => {
        const currencies = ['TRY', 'UAH', 'EUR', 'USD'];
        const currentIndex = currencies.indexOf(currency);
        const nextIndex = (currentIndex + 1) % currencies.length;
        setCurrencyEdited(currencies[nextIndex]);
    };

    // CRUD for Cards
    // Accepts an optional overrides object so callers (e.g. the Add-card dialog in Settings)
    // can supply real values instead of the blank template.
    // Every mutation below takes the updater form and re-normalizes `prev` rather than closing
    // over the arrays built during render. Two commits landing in the same tick — which is now
    // routine, since fields auto-commit on a timer — would otherwise silently clobber each other.
    const addCard = (overrides = {}) => setCardsEdited(prev => [...normalizeCards(prev, currency), {
        id: generateUUID(),
        name: 'New Card',
        limit: 0,
        money: 0,
        debt: 0,
        ...DEFAULT_CARD_FIELDS,
        currency,
        ...overrides
    }]);
    const updateCard = (id, field, value) => {
        setCardsEdited(prev => normalizeCards(prev, currency).map(card => (
            card.id === id ? { ...card, [field]: value } : card
        )));
    };
    const removeCard = (id) => {
        if (window.confirm('Delete this card?')) {
            setCardsEdited(prev => normalizeCards(prev, currency).filter(card => card.id !== id));
        }
    };

    // CRUD for Funds
    const addFund = () => setFundsEdited(prev => [
        ...normalizeFunds(prev, currency),
        { id: generateUUID(), name: 'New Account', amount: 0, currency }
    ]);
    const updateFund = (id, field, value) => {
        setFundsEdited(prev => normalizeFunds(prev, currency).map(fund => (
            fund.id === id ? { ...fund, [field]: value } : fund
        )));
    };
    const removeFund = (id) => {
        if (window.confirm('Delete this account?')) {
            setFundsEdited(prev => normalizeFunds(prev, currency).filter(fund => fund.id !== id));
        }
    };

    // CRUD for Others
    const addOther = () => setOthersEdited(prev => [...normalizeOthers(prev, currency), {
        id: generateUUID(),
        name: 'New Payment',
        amount: 0,
        ...DEFAULT_OTHER_FIELDS,
        currency
    }]);
    const updateOther = (id, field, value) => {
        setOthersEdited(prev => normalizeOthers(prev, currency).map(other => (
            other.id === id ? { ...other, [field]: value } : other
        )));
    };
    const removeOther = (id) => {
        if (window.confirm('Delete this payment?')) {
            setOthersEdited(prev => normalizeOthers(prev, currency).filter(other => other.id !== id));
        }
    };

    // CRUD for Investments
    const addInvestment = (type = 'custom', amount = 0) => setInvestmentsEdited(prev => [
        ...normalizeInvestments(prev, legacyGoldGrams),
        {
            id: generateUUID(),
            type,
            name: INVESTMENT_NAMES[type] || INVESTMENT_NAMES.custom,
            amount: numericValue(amount)
        }
    ]);
    const updateInvestment = (id, field, value) => {
        setInvestmentsEdited(prev => normalizeInvestments(prev, legacyGoldGrams).map(investment => (
            investment.id === id ? { ...investment, [field]: value } : investment
        )));
    };
    const removeInvestment = (id) => {
        if (window.confirm('Delete this investment?')) {
            setInvestmentsEdited(prev => (
                normalizeInvestments(prev, legacyGoldGrams).filter(investment => investment.id !== id)
            ));
        }
    };
    // Accepts a value or an updater, like a setState. The updater is handed the gold amount
    // read from `prev`, not the one captured at render, so rapid buy/sell taps compose.
    const setGoldGrams = (value) => {
        setInvestmentsEdited(prev => {
            const list = normalizeInvestments(prev, legacyGoldGrams);
            const gold = list.find(investment => investment.type === 'gold');
            const current = numericValue(gold?.amount);
            const nextAmount = Math.max(0, numericValue(typeof value === 'function' ? value(current) : value));

            return gold
                ? list.map(investment => investment.id === gold.id ? { ...investment, amount: nextAmount } : investment)
                : [createGoldInvestment(nextAmount), ...list];
        });
    };

    // CRUD for Income
    const addIncome = () => setIncomesEdited(prev => [...normalizeIncomes(prev), {
        id: generateUUID(),
        name: 'New Income',
        amount: 0,
        currency,
        date: new Date().toISOString().split('T')[0],
        isRecurring: true,
        recurrenceDay: 1,
        endDate: null
    }]);
    const updateIncome = (id, field, value) => {
        setIncomesEdited(prev => normalizeIncomes(prev).map(income => (
            income.id === id ? { ...income, [field]: value } : income
        )));
    };
    const removeIncome = (id) => {
        if (window.confirm('Delete this income?')) {
            setIncomesEdited(prev => normalizeIncomes(prev).filter(income => income.id !== id));
        }
    };

    // CRUD for Planner Events
    const addEvent = () => setEventsEdited(prev => [...normalizeEvents(prev), {
        id: generateUUID(),
        name: 'New Event',
        date: new Date().toISOString().split('T')[0],
        type: 'milestone',
        amount: 0
    }]);
    const updateEvent = (id, field, value) => {
        setEventsEdited(prev => normalizeEvents(prev).map(event => (
            event.id === id ? { ...event, [field]: value } : event
        )));
    };
    const removeEvent = (id) => {
        if (window.confirm('Delete this event?')) {
            setEventsEdited(prev => normalizeEvents(prev).filter(event => event.id !== id));
        }
    };

    // Calculations
    const totalLimit = cards.reduce((sum, card) => sum + convertCurrencyAmount(card.limit, card.currency), 0);
    const totalCardDebt = cards.reduce((sum, card) => sum + convertCurrencyAmount(card.debt, card.currency), 0);
    const totalDebt = totalCardDebt;
    const totalFundCash = funds.reduce((sum, fund) => sum + convertCurrencyAmount(fund.amount, fund.currency), 0);
    const totalCardMoney = cards.reduce((sum, card) => sum + convertCurrencyAmount(card.money, card.currency), 0);
    const totalInvestmentValue = investments.reduce((sum, investment) => sum + getInvestmentValue(investment), 0);
    const monthlyBurn = others.reduce((sum, other) => (
        other.isRecurring && isStillActive(other.endDate)
            ? sum + convertCurrencyAmount(other.amount, other.currency)
            : sum
    ), 0);
    const expectedMonthlyIncome = incomes.reduce((sum, income) => (
        income.isRecurring && isStillActive(income.endDate)
            ? sum + convertCurrencyAmount(income.amount, income.currency)
            : sum
    ), 0);
    // Drives the "rates aren't loaded" warning: a single-currency user must never see it.
    const hasForeignHoldings = [...cards, ...funds, ...others]
        .some(item => (item?.currency || currency) !== currency);

    // The Money headline is a cash figure: what you can actually spend, minus what you owe
    // on cards and the bills still to leave your account this month. Investments stay out of
    // it so a gold price move doesn't shift the number while you change nothing — they are
    // still in totalAssets, which History and the Investments screen need.
    const totalCash = totalFundCash + totalCardMoney;
    const totalAssets = totalCash + totalInvestmentValue;
    const overallNet = totalCash - totalCardDebt - monthlyBurn;
    const ccNet = totalCardMoney - totalCardDebt;
    const runway = monthlyBurn > 0 ? totalFundCash / monthlyBurn : null;

    // Snapshot Management
    const saveSnapshot = () => {
        const snapshot = {
            id: generateUUID(),
            date: new Date().toISOString(),
            overallNet,
            totalAssets,
            totalDebt,
            totalInvestmentValue,
            // Recorded so later comparisons don't have to reconstruct the cash position by
            // backing investments out of overallNet.
            totalCash,
            totalCardDebt,
            monthlyBurn,
            netBasis: 'cash',
            currency
        };
        setHistoryEdited(prev => [snapshot, ...(Array.isArray(prev) ? prev : [])]);
    };

    const deleteSnapshot = (id) => setHistoryEdited(prev => (
        (Array.isArray(prev) ? prev : []).filter(snapshot => snapshot.id !== id)
    ));

    // Advanced Stats. All of these compare against past snapshots, so they run on the cash
    // position (see utils/snapshots.js): snapshots in another currency, or too old to place
    // on that basis, are skipped rather than silently mixed in.
    const cashNet = totalCash - totalCardDebt;
    const comparableHistory = historyList
        .map(snapshot => ({ snapshot, value: snapshotCashNet(snapshot, currency) }))
        .filter(entry => entry.value !== null);
    const sortedComparable = [...comparableHistory].sort((a, b) => new Date(a.snapshot.date) - new Date(b.snapshot.date));

    const daysSince = (date) => Math.max((new Date() - new Date(date)) / (1000 * 60 * 60 * 24), 0.01);

    let velocity = 0;
    if (comparableHistory.length >= 1) {
        const latest = comparableHistory[0];
        velocity = (cashNet - latest.value) / daysSince(latest.snapshot.date);
    }

    let momentum = 0;
    if (sortedComparable.length >= 1) {
        const earliest = sortedComparable[0];
        momentum = (cashNet - earliest.value) / daysSince(earliest.snapshot.date);
    }

    const allTimeHigh = Math.max(cashNet, ...comparableHistory.map(entry => entry.value));

    // Backup & Restore Logic
    const exportBackup = () => {
        const data = {
            version: '4.0',
            timestamp: new Date().toISOString(),
            cards,
            funds,
            others,
            investments,
            incomes,
            events,
            currency,
            goldGrams,
            history: historyList
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prosperity_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const importBackup = (jsonData) => {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            if (!data.cards || !data.funds) {
                throw new Error("Invalid backup file format");
            }

            // The backup's own currency is the fallback for rows saved before per-item
            // currency existed — not the currency state, which setCurrency updates below.
            const backupCurrency = data.currency || 'TRY';
            setCardsEdited(normalizeCards(data.cards, backupCurrency));
            setFundsEdited(normalizeFunds(data.funds, backupCurrency));
            setOthersEdited(normalizeOthers(data.others, backupCurrency));
            setInvestmentsEdited(normalizeInvestments(data.investments, data.goldGrams));
            setIncomesEdited(normalizeIncomes(data.incomes));
            setEventsEdited(normalizeEvents(data.events));
            setCurrencyEdited(data.currency || 'TRY');
            setLegacyGoldGramsEdited(data.goldGrams || 0);
            setHistoryEdited(Array.isArray(data.history) ? data.history : []);

            console.log("Backup restored successfully");
            return true;
        } catch (err) {
            console.error("Backup restore failed:", err);
            alert("Failed to restore backup: " + err.message);
            return false;
        }
    };

    return {
        cards, funds, others, investments, incomes, events,
        currency, toggleCurrency, setCurrency: setCurrencyEdited,
        history: historyList,
        syncState, syncError, lastSyncedAt,
        goldGrams,
        setGoldGrams,
        goldPricePerGram,
        goldValue,
        goldChanges,
        exchangeRates,
        ratesReady,
        ratesFetchedAt,
        hasForeignHoldings,
        getInvestmentValue,
        convertCurrencyAmount,
        saveSnapshot, deleteSnapshot,
        addCard, updateCard, removeCard,
        addFund, updateFund, removeFund,
        addOther, updateOther, removeOther,
        addInvestment, updateInvestment, removeInvestment,
        addIncome, updateIncome, removeIncome,
        addEvent, updateEvent, removeEvent,
        exportBackup, importBackup,
        totals: {
            totalLimit,
            totalDebt,
            totalCardDebt,
            totalFundCash,
            totalCash,
            totalAssets,
            totalInvestmentValue,
            expectedMonthlyIncome,
            monthlyBurn,
            runway,
            overallNet,
            ccNet,
            velocity,
            momentum,
            allTimeHigh,
            goldValue,
            goldGrams
        }
    };
}
