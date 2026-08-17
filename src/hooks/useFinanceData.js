import { useState, useEffect, useCallback, useMemo } from 'react';
import useLocalStorage from './useLocalStorage';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../utils/supabase';

const DEFAULT_CARD_FIELDS = {
    interestRate: 0,
    statementDay: 31,
    paymentDueDays: 8,
    minimumPayment: 0,
    currency: 'TRY'
};

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
        { id: 101, name: 'Salary Account', amount: 8500 },
        { id: 102, name: 'Savings Account', amount: 12000 },
        { id: 103, name: 'Wallet / Cash', amount: 450 }
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

const numericValue = (value) => parseFloat(value) || 0;
const clampDay = (value, fallback) => Math.min(31, Math.max(1, numericValue(value) || fallback));

const normalizeCards = (items) => (
    Array.isArray(items)
        ? items.map(card => ({
            ...DEFAULT_CARD_FIELDS,
            ...card,
            statementDay: clampDay(card?.statementDay, DEFAULT_CARD_FIELDS.statementDay),
            paymentDueDays: Math.max(0, numericValue(card?.paymentDueDays ?? DEFAULT_CARD_FIELDS.paymentDueDays)),
            currency: card?.currency || DEFAULT_CARD_FIELDS.currency
        }))
        : DEFAULT_DATA.cards
);

const normalizeFunds = (items) => Array.isArray(items) ? items : DEFAULT_DATA.funds;

const normalizeOthers = (items) => (
    Array.isArray(items)
        ? items.map(other => ({
            ...DEFAULT_OTHER_FIELDS,
            ...other,
            recurrenceDay: clampDay(other?.recurrenceDay, DEFAULT_OTHER_FIELDS.recurrenceDay),
            currency: other?.currency || DEFAULT_OTHER_FIELDS.currency,
            endDate: other?.endDate || null
        }))
        : DEFAULT_DATA.others
);

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
    const [exchangeRates, setExchangeRates] = useState({ TRY: 1, UAH: 1, EUR: 1, USD: 1 });

    const cards = normalizeCards(rawCards);
    const funds = normalizeFunds(rawFunds);
    const others = normalizeOthers(rawOthers);
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

    // Keep the legacy storage/cloud field coherent for older clients and backups.
    useEffect(() => {
        if (!Array.isArray(rawInvestments)) return;
        const storedGold = numericValue(rawInvestments.find(item => item?.type === 'gold')?.amount);
        if (storedGold !== numericValue(legacyGoldGrams)) {
            setLegacyGoldGrams(storedGold);
        }
    }, [rawInvestments, legacyGoldGrams, setLegacyGoldGrams]);

    // Sync from Supabase on Login
    useEffect(() => {
        if (!session?.user?.id || session?.isDemo) return;

        const fetchData = async () => {
            const { data, error } = await supabase
                .from('user_data')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

            if (data && !error) {
                const extendedData = data.extended_data || {};

                // Cloud wins if it exists, while old records receive new defaults.
                setCards(normalizeCards(data.cards));
                setFunds(normalizeFunds(data.funds));
                setOthers(normalizeOthers(data.others));
                setCurrency(data.currency || 'TRY');
                setHistory(Array.isArray(data.history) ? data.history : []);
                setLegacyGoldGrams(data.gold_grams || 0);
                setInvestments(normalizeInvestments(extendedData.investments, data.gold_grams));
                setIncomes(normalizeIncomes(extendedData.incomes));
                setEvents(normalizeEvents(extendedData.events));
                console.log("Cloud sync complete: Data loaded from Supabase");
            } else if (error && error.code === 'PGRST116') {
                await pushToCloud();
                console.log("Cloud initialized: Local data pushed to Supabase");
            }
        };

        fetchData();
    // Local edits sync through the debounced cloud effect below; this fetch is session-scoped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]);

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
                if (fxData.rates) {
                    setExchangeRates({
                        TRY: fxData.rates.TRY,
                        UAH: fxData.rates.UAH,
                        EUR: fxData.rates.EUR,
                        USD: 1
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
    const pushToCloud = useCallback(async () => {
        if (!session?.user?.id || session?.isDemo) return;

        const normalizedInvestments = normalizeInvestments(rawInvestments, legacyGoldGrams);
        const legacyGold = numericValue(normalizedInvestments.find(item => item.type === 'gold')?.amount);
        const payload = {
            user_id: session.user.id,
            cards: normalizeCards(rawCards),
            funds: normalizeFunds(rawFunds),
            others: normalizeOthers(rawOthers),
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

        const { error } = await supabase
            .from('user_data')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) console.error("Cloud push failed:", error);
    }, [session, rawCards, rawFunds, rawOthers, currency, historyList, rawInvestments, rawIncomes, rawEvents, legacyGoldGrams]);

    // Track changes and push
    useEffect(() => {
        const timer = setTimeout(() => {
            pushToCloud();
        }, 2000); // 2 second debounce

        return () => clearTimeout(timer);
    }, [rawCards, rawFunds, rawOthers, currency, history, rawInvestments, rawIncomes, rawEvents, legacyGoldGrams, pushToCloud]);

    const toggleCurrency = () => {
        const currencies = ['TRY', 'UAH', 'EUR', 'USD'];
        const currentIndex = currencies.indexOf(currency);
        const nextIndex = (currentIndex + 1) % currencies.length;
        setCurrency(currencies[nextIndex]);
    };

    // CRUD for Cards
    const addCard = () => setCards([...cards, {
        id: generateUUID(),
        name: 'New Card',
        limit: 0,
        money: 0,
        debt: 0,
        ...DEFAULT_CARD_FIELDS,
        currency
    }]);
    const updateCard = (id, field, value) => {
        setCards(cards.map(card => card.id === id ? { ...card, [field]: value } : card));
    };
    const removeCard = (id) => {
        if (window.confirm('Delete this card?')) {
            setCards(cards.filter(card => card.id !== id));
        }
    };

    // CRUD for Funds
    const addFund = () => setFunds([...funds, { id: generateUUID(), name: 'New Account', amount: 0 }]);
    const updateFund = (id, field, value) => {
        setFunds(funds.map(fund => fund.id === id ? { ...fund, [field]: value } : fund));
    };
    const removeFund = (id) => {
        if (window.confirm('Delete this account?')) {
            setFunds(funds.filter(fund => fund.id !== id));
        }
    };

    // CRUD for Others
    const addOther = () => setOthers([...others, {
        id: generateUUID(),
        name: 'New Payment',
        amount: 0,
        ...DEFAULT_OTHER_FIELDS,
        currency
    }]);
    const updateOther = (id, field, value) => {
        setOthers(others.map(other => other.id === id ? { ...other, [field]: value } : other));
    };
    const removeOther = (id) => {
        if (window.confirm('Delete this payment?')) {
            setOthers(others.filter(other => other.id !== id));
        }
    };

    // CRUD for Investments
    const addInvestment = (type = 'custom', amount = 0) => setInvestments([
        ...investments,
        {
            id: generateUUID(),
            type,
            name: INVESTMENT_NAMES[type] || INVESTMENT_NAMES.custom,
            amount: numericValue(amount)
        }
    ]);
    const updateInvestment = (id, field, value) => {
        setInvestments(investments.map(investment => (
            investment.id === id ? { ...investment, [field]: value } : investment
        )));
    };
    const removeInvestment = (id) => {
        if (window.confirm('Delete this investment?')) {
            setInvestments(investments.filter(investment => investment.id !== id));
        }
    };
    const setGoldGrams = useCallback((value) => {
        const nextAmount = Math.max(0, numericValue(typeof value === 'function' ? value(goldGrams) : value));

        if (primaryGold) {
            setInvestments(investments.map(investment => (
                investment.id === primaryGold.id ? { ...investment, amount: nextAmount } : investment
            )));
        } else {
            setInvestments([createGoldInvestment(nextAmount), ...investments]);
        }
    }, [goldGrams, investments, primaryGold, setInvestments]);

    // CRUD for Income
    const addIncome = () => setIncomes([...incomes, {
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
        setIncomes(incomes.map(income => income.id === id ? { ...income, [field]: value } : income));
    };
    const removeIncome = (id) => {
        if (window.confirm('Delete this income?')) {
            setIncomes(incomes.filter(income => income.id !== id));
        }
    };

    // CRUD for Planner Events
    const addEvent = () => setEvents([...events, {
        id: generateUUID(),
        name: 'New Event',
        date: new Date().toISOString().split('T')[0],
        type: 'milestone',
        amount: 0
    }]);
    const updateEvent = (id, field, value) => {
        setEvents(events.map(event => event.id === id ? { ...event, [field]: value } : event));
    };
    const removeEvent = (id) => {
        if (window.confirm('Delete this event?')) {
            setEvents(events.filter(event => event.id !== id));
        }
    };

    // Calculations
    const totalLimit = cards.reduce((sum, card) => sum + convertCurrencyAmount(card.limit, card.currency), 0);
    const totalCardDebt = cards.reduce((sum, card) => sum + convertCurrencyAmount(card.debt, card.currency), 0);
    const totalDebt = totalCardDebt;
    const totalFundCash = funds.reduce((sum, fund) => sum + numericValue(fund.amount), 0);
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
    const totalAssets = totalFundCash + totalCardMoney + totalInvestmentValue;
    const overallNet = totalAssets - totalDebt;
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
            currency
        };
        setHistory([snapshot, ...historyList]);
    };

    const deleteSnapshot = (id) => setHistory(historyList.filter(snapshot => snapshot.id !== id));

    // Advanced Stats
    const sortedHistory = [...historyList].sort((a, b) => new Date(a.date) - new Date(b.date));

    let velocity = 0;
    if (historyList.length >= 1) {
        const lastSnap = historyList[0];
        const days = Math.max((new Date() - new Date(lastSnap.date)) / (1000 * 60 * 60 * 24), 0.01);
        velocity = (overallNet - lastSnap.overallNet) / days;
    }

    let momentum = 0;
    if (sortedHistory.length >= 1) {
        const firstSnap = sortedHistory[0];
        const days = Math.max((new Date() - new Date(firstSnap.date)) / (1000 * 60 * 60 * 24), 0.01);
        momentum = (overallNet - firstSnap.overallNet) / days;
    }

    const allTimeHigh = Math.max(overallNet, ...historyList.map(snapshot => snapshot.overallNet));

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

            setCards(normalizeCards(data.cards));
            setFunds(normalizeFunds(data.funds));
            setOthers(normalizeOthers(data.others));
            setInvestments(normalizeInvestments(data.investments, data.goldGrams));
            setIncomes(normalizeIncomes(data.incomes));
            setEvents(normalizeEvents(data.events));
            setCurrency(data.currency || 'TRY');
            setLegacyGoldGrams(data.goldGrams || 0);
            setHistory(Array.isArray(data.history) ? data.history : []);

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
        currency, toggleCurrency, setCurrency,
        history: historyList,
        goldGrams,
        setGoldGrams,
        goldPricePerGram,
        goldValue,
        goldChanges,
        exchangeRates,
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
