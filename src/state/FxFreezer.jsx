import { useEffect, useRef } from 'react';
import { useStoreState } from './hooks';
import { useMarket, historicalRates, latestRates } from './market';
import { datesNeedingRates, writeFxDay } from './actions';
import { today as todayISO } from '../lib/dates';

/**
 * Background job: every transaction is converted at the rate of its own day. When a record's
 * date has no frozen rates yet (entered offline, backdated, imported, or a new currency was
 * added), fetch that day's published rates once and store them in the document.
 */
export default function FxFreezer() {
    const { doc, ready } = useStoreState();
    const market = useMarket();
    const busy = useRef(false);
    // One attempt per date per session: a currency the source doesn't publish must not loop.
    const tried = useRef(new Set());

    useEffect(() => {
        if (!ready || busy.current) return;
        const pending = datesNeedingRates(doc).filter((p) => !tried.current.has(p.date)).slice(0, 6);
        if (!pending.length) return;
        busy.current = true;
        (async () => {
            for (const { date, codes } of pending) {
                const rates = date >= todayISO() ? latestRates() : await historicalRates(date);
                if (!rates && date >= todayISO()) continue; // today's rates not loaded yet; retry when they are
                tried.current.add(date);
                if (rates) writeFxDay(date, rates, codes);
            }
            busy.current = false;
        })();
    }, [doc, ready, market.rates]);

    return null;
}
