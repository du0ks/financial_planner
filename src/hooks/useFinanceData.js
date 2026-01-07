import { useState, useEffect, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../utils/supabase';

const DEFAULT_DATA = {
    cards: [
        { id: 1, name: 'Card A (Main Card)', limit: 15000, money: 2000, debt: 3500 },
        { id: 2, name: 'Card B (Backup)', limit: 5000, money: 0, debt: 0 },
    ],
    funds: [
        { id: 101, name: 'Salary Account', amount: 8500 },
        { id: 102, name: 'Savings Account', amount: 12000 },
        { id: 103, name: 'Wallet / Cash', amount: 450 }
    ],
    others: [
        { id: 201, name: 'Rent', amount: 0 },
        { id: 202, name: 'Dorm / Tuition', amount: 0 }
    ]
};

export default function useFinanceData(session) {
    const [rawCards, setCards] = useLocalStorage('finance_cards_v3', DEFAULT_DATA.cards);
    const [rawFunds, setFunds] = useLocalStorage('finance_funds_v3', DEFAULT_DATA.funds);
    const [rawOthers, setOthers] = useLocalStorage('finance_others_v3', DEFAULT_DATA.others);
    const [currency, setCurrency] = useLocalStorage('finance_currency_v3', 'TRY');
    const [history, setHistory] = useLocalStorage('finance_history_v3', []);
    const [goldGrams, setGoldGrams] = useLocalStorage('finance_gold_v3', 0);
    const [goldPrice, setGoldPrice] = useState(0); // USD per gram
    const [goldChanges, setGoldChanges] = useState({ d1: 0, w1: 0, m1: 0, y1: 0 });
    const [exchangeRates, setExchangeRates] = useState({ TRY: 1, UAH: 1, EUR: 1, USD: 1 });

    // Sync from Supabase on Login
    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchData = async () => {
            const { data, error } = await supabase
                .from('user_data')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

            if (data && !error) {
                // Simplistic sync: Cloud wins if it exists
                setCards(data.cards);
                setFunds(data.funds);
                setOthers(data.others);
                setCurrency(data.currency);
                setHistory(data.history);
                setGoldGrams(data.gold_grams || 0);
                console.log("Cloud sync complete: Data loaded from Supabase");
            } else if (error && error.code === 'PGRST116') {
                // No record yet, push local data to cloud
                await pushToCloud();
                console.log("Cloud initialized: Local data pushed to Supabase");
            }
        };

        fetchData();
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

    // Push to Supabase on changes (throttled)
    const pushToCloud = useCallback(async () => {
        if (!session?.user?.id) return;

        const payload = {
            user_id: session.user.id,
            cards: rawCards,
            funds: rawFunds,
            others: rawOthers,
            currency: currency,
            history: history,
            gold_grams: goldGrams,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('user_data')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) console.error("Cloud push failed:", error);
    }, [session, rawCards, rawFunds, rawOthers, currency, history, goldGrams]);

    // Track changes and push
    useEffect(() => {
        const timer = setTimeout(() => {
            pushToCloud();
        }, 2000); // 2 second debounce

        return () => clearTimeout(timer);
    }, [rawCards, rawFunds, rawOthers, currency, history, goldGrams, pushToCloud]);

    const toggleCurrency = () => {
        const currencies = ['TRY', 'UAH', 'EUR', 'USD'];
        const currentIndex = currencies.indexOf(currency);
        const nextIndex = (currentIndex + 1) % currencies.length;
        setCurrency(currencies[nextIndex]);
    };

    // Ensure all data types are correct
    const cards = Array.isArray(rawCards) ? rawCards : DEFAULT_DATA.cards;
    const funds = Array.isArray(rawFunds) ? rawFunds : DEFAULT_DATA.funds;
    const others = Array.isArray(rawOthers) ? rawOthers : DEFAULT_DATA.others;
    const historyList = Array.isArray(history) ? history : [];

    // CRUD for Cards
    const addCard = () => setCards([...cards, { id: generateUUID(), name: 'New Card', limit: 0, money: 0, debt: 0 }]);
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
    const addOther = () => setOthers([...others, { id: generateUUID(), name: 'New Payment', amount: 0 }]);
    const updateOther = (id, field, value) => {
        setOthers(others.map(other => other.id === id ? { ...other, [field]: value } : other));
    };
    const removeOther = (id) => {
        if (window.confirm('Delete this payment?')) {
            setOthers(others.filter(other => other.id !== id));
        }
    };

    // Calculations
    const totalLimit = cards.reduce((sum, c) => sum + (parseFloat(c.limit) || 0), 0);
    const totalCardDebt = cards.reduce((sum, c) => sum + (parseFloat(c.debt) || 0), 0);
    const totalOtherDebt = others.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
    const totalDebt = totalCardDebt + totalOtherDebt;

    const totalFundCash = funds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    const totalCardMoney = cards.reduce((sum, c) => sum + (parseFloat(c.money) || 0), 0);

    // Gold Value Calculation (Keep separate from main totals as per user request)
    const currentGoldRate = goldPrice * (exchangeRates[currency] || 1);
    const goldValue = goldGrams * currentGoldRate;

    const totalAssets = totalFundCash + totalCardMoney; // Gold excluded from main dashboard assets
    const overallNet = totalAssets - totalDebt;
    const ccNet = cards.reduce((sum, c) => sum + ((parseFloat(c.money) || 0) - (parseFloat(c.debt) || 0)), 0);

    // Snapshot Management
    const saveSnapshot = () => {
        const snapshot = {
            id: generateUUID(),
            date: new Date().toISOString(),
            overallNet,
            totalAssets,
            totalDebt,
            currency
        };
        setHistory([snapshot, ...historyList]);
    };

    const deleteSnapshot = (id) => setHistory(historyList.filter(s => s.id !== id));

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

    const allTimeHigh = Math.max(overallNet, ...historyList.map(s => s.overallNet));

    return {
        cards, funds, others,
        currency, toggleCurrency,
        history: historyList,
        goldGrams,
        setGoldGrams,
        goldPricePerGram: goldPrice * (exchangeRates[currency] || 1),
        goldValue,
        goldChanges,
        exchangeRates,
        saveSnapshot, deleteSnapshot,
        addCard, updateCard, removeCard,
        addFund, updateFund, removeFund,
        addOther, updateOther, removeOther,
        totals: {
            totalLimit,
            totalDebt,
            totalAssets,
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
