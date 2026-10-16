import { useEffect, useState } from 'react';
import { useModel } from '../state/hooks';
import { historicalRates } from '../state/market';
import { get } from '../lib/doc';
import { formatDate } from '../lib/dates';
import { equivalents } from '../lib/fx';
import { formatMoney, formatNumber } from '../lib/money';
import S from '../i18n/strings';

/** The other currencies to show an amount in: display currency first, then the user's own. */
export function equivalentTargets(settings) {
    return [settings.displayCurrency, ...settings.currencies];
}

/**
 * An amount in the user's other currencies at the rate of its own date: the rate frozen with
 * the entry when there is one, otherwise that day's published rate (today's for today).
 */
export default function Equivalents({ minor, currency, date }) {
    const { doc, settings, fx, today } = useModel();
    const frozen = date ? get(doc, 'fxDays', date) : null;
    const [past, setPast] = useState(null);
    const needsHistory = !frozen && date && date < today;
    useEffect(() => {
        if (!needsHistory) return undefined;
        let alive = true;
        historicalRates(date).then((rates) => { if (alive) setPast(rates ? { date, rates } : null); });
        return () => { alive = false; };
    }, [needsHistory, date]);

    const dayFx = frozen
        ? { rates: frozen.rates, overrides: frozen.overrides || {} }
        : needsHistory ? (past?.date === date ? { rates: past.rates, overrides: settings.fxOverrides } : null) : fx;
    if (!dayFx || !minor) return null;
    const list = equivalents(minor, currency, equivalentTargets(settings), dayFx);
    if (!list.length) return null;
    return (
        <div className="border border-line bg-field px-3 py-2.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                {S.tx.atRateOf(date ? formatDate(date, { year: true }) : '')} · {frozen ? S.tx.rateSaved : S.tx.rateOnSave}
            </p>
            <p className="tabular mt-1 font-mono text-[16px] text-white">
                {list.map((e) => S.common.approx(formatMoney(e.minor, e.code))).join(' · ')}
            </p>
            <p className="tabular mt-0.5 font-mono text-[12px] text-dim">
                {S.tx.rateLine(currency, list.map((e) => `${formatNumber(e.rate.toString(), 4)} ${e.code}`).join(' · '))}
            </p>
        </div>
    );
}
