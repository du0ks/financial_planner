import Big from 'big.js';
import { fromMinor, toMinor } from './money';

// Rates are kept the way the source publishes them: units of each currency per 1 USD, as
// decimal strings so no precision is lost between fetch, storage and arithmetic.
//
// A manual override is a direct pair rate, "1 CZK = 2.30 TRY", stored as { 'CZK/TRY': '2.30' }.
// It wins for that pair in both directions; every other pair still goes through USD.

export const TROY_OUNCE_GRAMS = '31.1034768';

export function pairKey(from, to) {
    return `${from}/${to}`;
}

/** How many `to` you get for one `from`, as a Big. Null when either rate is missing. */
export function pairRate(from, to, fx) {
    if (from === to) return new Big(1);
    const overrides = fx?.overrides || {};
    if (overrides[pairKey(from, to)]) return new Big(overrides[pairKey(from, to)]);
    if (overrides[pairKey(to, from)]) return new Big(1).div(new Big(overrides[pairKey(to, from)]));
    const rates = fx?.rates || {};
    if (!rates[from] || !rates[to]) return null;
    return new Big(rates[to]).div(new Big(rates[from]));
}

/** Converts integer minor units between currencies. Returns null when a rate is missing. */
export function convertMinor(minor, from, to, fx) {
    if (!minor) return 0;
    if (from === to) return minor;
    const rate = pairRate(from, to, fx);
    if (rate === null) return null;
    return toMinor(fromMinor(minor, from).times(rate), to);
}

/** Like convertMinor but treats a missing rate as zero, and reports it. */
export function convertOrZero(minor, from, to, fx, missing) {
    const value = convertMinor(minor, from, to, fx);
    if (value === null) {
        if (missing) missing.add(from === to ? to : `${from}/${to}`);
        return 0;
    }
    return value;
}

/** Gold spot price for one gram, in `currency`, as a Big. Needs rates.XAU (ounces per USD). */
export function goldGramPrice(currency, fx) {
    const rates = fx?.rates || {};
    if (!rates.XAU || !rates[currency]) return null;
    const usdPerOunce = new Big(1).div(new Big(rates.XAU));
    return usdPerOunce.div(TROY_OUNCE_GRAMS).times(pairRate('USD', currency, fx) || 0);
}

/** Value of `mg` milligrams of gold in minor units of `currency`, or null. */
export function goldValueMinor(mg, currency, fx) {
    const gram = goldGramPrice(currency, fx);
    if (gram === null) return null;
    return toMinor(gram.times(mg || 0).div(1000), currency);
}

/** Picks the rates a record needs to keep, so a frozen rate set stays small. */
export function pickRates(rates, codes) {
    const picked = { USD: '1' };
    for (const code of codes) {
        if (rates?.[code]) picked[code] = String(rates[code]);
    }
    if (rates?.XAU) picked.XAU = String(rates.XAU);
    return picked;
}

/** Percentage change between two Big/number prices, as a plain number (0.05 = +5%). */
export function changeRatio(from, to) {
    if (from === null || to === null || from === undefined || to === undefined) return null;
    const a = new Big(from);
    if (a.eq(0)) return null;
    return Number(new Big(to).minus(a).div(a).toString());
}
