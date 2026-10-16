import { useSyncExternalStore } from 'react';
import { today as todayISO } from '../lib/dates';

// Market data is not user data: it is shared by every account on this device and cached so
// the app still converts offline.
//
// Sources (both free, no key, CORS-enabled):
// - fawazahmed0 currency-api: daily rates for every ISO currency plus XAU, with history by
//   date. Used for FX and for gold history (so a % change is a TRY-to-TRY comparison).
// - gold-api.com: live XAU/USD spot, so today's gold price moves during the day.

const LATEST_KEY = 'pv5-market';
const HISTORY_PREFIX = 'pv5-fxhist:';
const HISTORY_LIMIT = 150;
const REFRESH = 15 * 60 * 1000;

const latestUrls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
];
const historyUrls = (date) => [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/usd.min.json`,
];
const GOLD_URL = 'https://api.gold-api.com/price/XAU';

const listeners = new Set();
let state = readCache();
let started = false;
const inflight = new Map();

function readCache() {
    try {
        const raw = window.localStorage.getItem(LATEST_KEY);
        if (raw) return { ...JSON.parse(raw), loading: false, error: null };
    } catch {
        // ignore
    }
    return { rates: null, date: null, fetchedAt: null, goldLive: null, loading: false, error: null };
}

function emit(patch) {
    state = { ...state, ...patch };
    try {
        const { rates, date, fetchedAt, goldLive } = state;
        window.localStorage.setItem(LATEST_KEY, JSON.stringify({ rates, date, fetchedAt, goldLive }));
    } catch {
        // ignore
    }
    for (const listener of listeners) listener();
}

/** currency-api's { usd: { try: 49.5, ... } } → { TRY: '49.5', ... } */
function normalizeRates(json) {
    const source = json?.usd;
    if (!source) return null;
    const rates = {};
    for (const [code, value] of Object.entries(source)) {
        if (typeof value === 'number' && value > 0 && /^[a-z]{3}$/.test(code)) rates[code.toUpperCase()] = String(value);
    }
    rates.USD = '1';
    return rates;
}

async function firstJson(urls) {
    let lastError = null;
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) return await response.json();
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('No response');
}

export async function refreshMarket() {
    emit({ loading: true });
    const patch = { loading: false };
    try {
        const json = await firstJson(latestUrls);
        const rates = normalizeRates(json);
        if (rates) Object.assign(patch, { rates, date: json.date, fetchedAt: Date.now(), error: null });
    } catch (error) {
        patch.error = error.message;
    }
    try {
        const response = await fetch(GOLD_URL);
        const json = await response.json();
        if (json?.price > 0) patch.goldLive = { usdPerOunce: String(json.price), at: json.updatedAt || new Date().toISOString() };
    } catch {
        // daily XAU from currency-api remains as the fallback
    }
    emit(patch);
}

export function startMarket() {
    if (started) return;
    started = true;
    refreshMarket();
    window.setInterval(refreshMarket, REFRESH);
}

/** Today's rates, with live gold folded in as XAU (ounces per USD). */
export function latestRates(market = state) {
    if (!market.rates) return null;
    const rates = { ...market.rates };
    if (market.goldLive?.usdPerOunce) rates.XAU = String(1 / Number(market.goldLive.usdPerOunce));
    return rates;
}

function readHistory(date) {
    try {
        const raw = window.localStorage.getItem(HISTORY_PREFIX + date);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeHistory(date, rates) {
    try {
        window.localStorage.setItem(HISTORY_PREFIX + date, JSON.stringify(rates));
        const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(HISTORY_PREFIX)).sort();
        for (const key of keys.slice(0, Math.max(0, keys.length - HISTORY_LIMIT))) window.localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

/** Rates as published for a past date ('YYYY-MM-DD'). Null when unavailable. */
export function historicalRates(date) {
    if (date >= todayISO()) return Promise.resolve(latestRates());
    const cached = readHistory(date);
    if (cached) return Promise.resolve(cached);
    if (inflight.has(date)) return inflight.get(date);
    const request = firstJson(historyUrls(date))
        .then((json) => {
            const rates = normalizeRates(json);
            if (rates) writeHistory(date, rates);
            return rates;
        })
        .catch(() => null)
        .finally(() => inflight.delete(date));
    inflight.set(date, request);
    return request;
}

export function useMarket() {
    return useSyncExternalStore(
        (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        () => state,
    );
}
