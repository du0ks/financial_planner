import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getState, subscribe } from './store';
import { latestRates, useMarket } from './market';
import { buildModel } from '../lib/model';
import { today as todayISO } from '../lib/dates';

export function useStoreState() {
    return useSyncExternalStore(subscribe, getState);
}

/** Today's date, refreshed when the app comes back to the foreground after midnight. */
export function useToday() {
    const [today, setToday] = useState(todayISO());
    useEffect(() => {
        const refresh = () => setToday(todayISO());
        document.addEventListener('visibilitychange', refresh);
        const timer = window.setInterval(refresh, 60 * 1000);
        return () => {
            document.removeEventListener('visibilitychange', refresh);
            window.clearInterval(timer);
        };
    }, []);
    return today;
}

export function useModel() {
    const { doc } = useStoreState();
    const market = useMarket();
    const today = useToday();
    const rates = useMemo(() => latestRates(market), [market]);
    return useMemo(() => ({ ...buildModel(doc, rates, today), today, market }), [doc, rates, today, market]);
}
