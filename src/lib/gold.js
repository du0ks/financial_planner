import Big from 'big.js';
import { list } from './doc';
import { convertOrZero, goldValueMinor } from './fx';
import { fxForDate } from './ledger';
import { parseDecimal } from './money';

// Gold is held in integer milligrams, split into named portions. Only a portion marked
// `available` counts toward money you can use; the rest counts toward net worth only.
//
// portion   { name, available, order }
// goldEvent { type: buy|sell|move|adjust, date, mg, portionId, toPortionId (move),
//             price (total paid/received, minor units), currency, note }
//           mg is always positive, except an adjust, which may be negative.

/** "6,8" or "6.800" grams → integer milligrams, or null. */
export function parseGrams(input) {
    const grams = parseDecimal(input, 3);
    if (grams === null) return null;
    return Number(grams.times(1000).round(0, Big.roundHalfUp).toString());
}

export function formatGrams(mg, locale) {
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format((mg || 0) / 1000)} g`;
}

export function goldHoldings(doc) {
    const byPortion = {};
    for (const portion of list(doc, 'portions')) byPortion[portion.id] = 0;
    const add = (id, mg) => { if (id) byPortion[id] = (byPortion[id] || 0) + mg; };
    const events = list(doc, 'goldEvents').sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
    for (const event of events) {
        if (event.type === 'buy') add(event.portionId, event.mg);
        if (event.type === 'sell') add(event.portionId, -event.mg);
        if (event.type === 'adjust') add(event.portionId, event.mg);
        if (event.type === 'move') {
            add(event.portionId, -event.mg);
            add(event.toPortionId, event.mg);
        }
    }
    return byPortion;
}

export function goldTotals(doc) {
    const holdings = goldHoldings(doc);
    const portions = list(doc, 'portions');
    let availableMg = 0;
    let lockedMg = 0;
    for (const portion of portions) {
        if (portion.available) availableMg += holdings[portion.id] || 0;
        else lockedMg += holdings[portion.id] || 0;
    }
    return { holdings, availableMg, lockedMg, totalMg: availableMg + lockedMg };
}

/**
 * Average-cost basis of the gold still held, from buys that recorded a price. Sells take
 * grams out at the running average cost. Returns the grams covered by a known cost and that
 * cost in `currency`, converted at each purchase's own-day rate.
 */
export function goldCostBasis(doc, currency, latestFx) {
    let mg = 0;
    let cost = 0;
    const events = list(doc, 'goldEvents')
        .filter((event) => event.type === 'buy' || event.type === 'sell')
        .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
    for (const event of events) {
        if (event.type === 'buy' && event.price) {
            cost += convertOrZero(event.price, event.currency, currency, fxForDate(doc, event.date, latestFx));
            mg += event.mg;
        } else if (event.type === 'sell' && mg > 0) {
            const taken = Math.min(mg, event.mg);
            cost -= Math.round((cost * taken) / mg);
            mg -= taken;
        }
    }
    return { mg, cost };
}

export function goldUnrealized(doc, currency, fx) {
    const basis = goldCostBasis(doc, currency, fx);
    if (!basis.mg) return null;
    const value = goldValueMinor(basis.mg, currency, fx);
    if (value === null) return null;
    return { ...basis, value, gain: value - basis.cost };
}
