import { convertOrZero, goldValueMinor, pickRates } from './fx';
import { cardDebt, CREDIT } from './ledger';
import { debtAmount } from './model';
import { newId } from './doc';

// A snapshot records what you held, in each item's own currency, and the prices of that day.
// Keeping quantities and prices apart is what lets a change between two snapshots be split
// into what you saved (quantities moved) and what the market did (prices moved).

const addTo = (bucket, currency, minor) => {
    if (!minor) return;
    bucket[currency] = (bucket[currency] || 0) + minor;
};

export function makeSnapshot(model, date = new Date().toISOString()) {
    const holdings = { available: {}, locked: {}, debt: {}, receivable: {}, goldAvailableMg: model.gold.availableMg, goldLockedMg: model.gold.lockedMg };
    for (const account of model.accounts) {
        if (account.kind === CREDIT) {
            addTo(holdings.debt, account.currency, cardDebt(account.balance));
            if (account.balance > 0) addTo(holdings.available, account.currency, account.balance);
        } else {
            addTo(account.available === false ? holdings.locked : holdings.available, account.currency, account.balance);
        }
    }
    for (const tx of model.debts) {
        if (tx.debt.certainty !== 'certain') continue;
        addTo(tx.debt.direction === 'iOwe' ? holdings.debt : holdings.receivable, tx.currency, debtAmount(tx));
    }
    const codes = new Set([model.display]);
    for (const bucket of [holdings.available, holdings.locked, holdings.debt, holdings.receivable]) {
        Object.keys(bucket).forEach((code) => codes.add(code));
    }
    return {
        id: newId('snap'),
        date,
        holdings,
        prices: model.ratesReady ? { rates: pickRates(model.fx.rates, codes), overrides: model.fx.overrides || {} } : null,
    };
}

/** Net worth and available money of a snapshot in `currency`, at the given prices (default: its own). */
export function snapshotValue(snapshot, currency, prices = snapshot.prices) {
    if (!prices?.rates) return null;
    const missing = new Set();
    const sum = (bucket) => Object.entries(bucket || {}).reduce((total, [code, minor]) => total + convertOrZero(minor, code, currency, prices, missing), 0);
    const h = snapshot.holdings;
    const goldAvailable = h.goldAvailableMg ? goldValueMinor(h.goldAvailableMg, currency, prices) : 0;
    const goldLocked = h.goldLockedMg ? goldValueMinor(h.goldLockedMg, currency, prices) : 0;
    if (goldAvailable === null || goldLocked === null || missing.size) return null;
    const available = sum(h.available);
    const locked = sum(h.locked);
    const debt = sum(h.debt);
    const receivable = sum(h.receivable);
    return {
        available,
        netWorth: available + locked + goldAvailable + goldLocked - debt + receivable,
        owned: available + locked + goldAvailable + goldLocked + receivable,
        debt,
        gold: goldAvailable + goldLocked,
    };
}

/**
 * Splits the change in net worth between two snapshots:
 *   saved  = new holdings at the OLD prices − old holdings at the old prices
 *   market = new holdings at the NEW prices − new holdings at the old prices (gold, FX)
 * saved + market = total change, exactly.
 */
export function decompose(before, after, currency) {
    const oldAtOld = snapshotValue(before, currency, before.prices);
    const newAtOld = snapshotValue(after, currency, before.prices);
    const newAtNew = snapshotValue(after, currency, after.prices);
    if (!oldAtOld || !newAtOld || !newAtNew) return null;
    return {
        total: newAtNew.netWorth - oldAtOld.netWorth,
        saved: newAtOld.netWorth - oldAtOld.netWorth,
        market: newAtNew.netWorth - newAtOld.netWorth,
    };
}
