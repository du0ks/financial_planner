import { useEffect, useState } from 'react';
import { ArrowRightLeft, Coins, Minus, PiggyBank, Plus, Scale, SlidersHorizontal } from 'lucide-react';
import { useModel } from '../state/hooks';
import { historicalRates } from '../state/market';
import { list } from '../lib/doc';
import { addDays, formatDate } from '../lib/dates';
import { changeRatio, goldGramPrice } from '../lib/fx';
import { formatGrams, goldUnrealized } from '../lib/gold';
import { formatMoney, formatPercent, getNumberLocale, toMinor } from '../lib/money';
import { Button, DualMoney, Empty, Money, Panel, Row, cx } from '../ui/kit';
import { openSheet } from '../ui/sheets';
import S from '../i18n/strings';

const PERIODS = [['d1', 1], ['w1', 7], ['m1', 30], ['y1', 365]];

/**
 * Gold price changes in the display currency: today's gram price against the gram price of
 * the same day back then, each computed from XAU/USD and USD/<currency> of its own date. In
 * lira terms that captures the lira's fall as well as gold's move.
 */
function useGoldChanges(currency, current, today) {
    const [past, setPast] = useState({});
    useEffect(() => {
        let alive = true;
        Promise.all(PERIODS.map(([key, days]) => historicalRates(addDays(today, -days)).then((rates) => [key, rates ? goldGramPrice(currency, { rates }) : null])))
            .then((entries) => { if (alive) setPast(Object.fromEntries(entries)); });
        return () => { alive = false; };
    }, [currency, today]);
    return Object.fromEntries(PERIODS.map(([key]) => [key, current && past[key] ? changeRatio(past[key], current) : null]));
}

export default function GoldScreen() {
    const model = useModel();
    const { doc, display, gold, today, fx, investmentAccounts } = model;
    const changes = useGoldChanges(display, gold.gramPrice, today);
    const totalValue = gold.availableValue + gold.lockedValue;
    const portions = list(doc, 'portions').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const events = list(doc, 'goldEvents').sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const gain = goldUnrealized(doc, display, fx);
    const locale = getNumberLocale();
    const gramMinor = gold.gramPrice ? toMinor(gold.gramPrice, display) : null;

    return (
        <div className="flex flex-col gap-6">
            <section className="border border-gold/30 bg-gradient-to-b from-[#150f06] to-[#08060e] p-5 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted">{S.gold.heroLabel}</p>
                        <div className="mt-3 flex flex-wrap items-baseline gap-4">
                            <span className="tabular font-display text-[44px] font-extrabold leading-none text-white md:text-[72px]">{formatMoney(totalValue, display, { decimals: 'never' })}</span>
                            <span className="inline-flex items-center gap-2 border border-gold/50 bg-gold/10 px-3 py-1.5 font-mono text-[15px] text-gold"><Scale size={15} />{formatGrams(gold.totalMg, locale)}</span>
                        </div>
                    </div>
                    <div className="border border-line bg-black/30 px-5 py-4">
                        <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{S.gold.perGram}</p>
                        <p className="tabular mt-1 font-mono text-[26px] font-semibold text-gold">{gramMinor === null ? '—' : formatMoney(gramMinor, display, { decimals: 'never' })}</p>
                        <p className="mt-1 text-[12px] text-dim">{gramMinor === null ? S.gold.noPrice : S.gold.source}</p>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button variant="gold" icon={Plus} onClick={() => openSheet('gold', { type: 'buy' })}>{S.gold.buy}</Button>
                    <Button icon={Minus} onClick={() => openSheet('gold', { type: 'sell' })}>{S.gold.sell}</Button>
                    <Button icon={ArrowRightLeft} onClick={() => openSheet('gold', { type: 'move' })}>{S.gold.move}</Button>
                    <Button icon={SlidersHorizontal} onClick={() => openSheet('gold', { type: 'adjust' })}>{S.gold.adjust}</Button>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title={S.gold.portions} subtitle={S.gold.portionsExplain} bare>
                    {portions.map((portion) => {
                        const mg = gold.holdings[portion.id] || 0;
                        const value = gold.gramPrice ? toMinor(gold.gramPrice.times(mg).div(1000), display) : 0;
                        return (
                            <Row
                                key={portion.id}
                                icon={Coins}
                                iconTone={portion.available ? 'gold' : 'muted'}
                                title={portion.name}
                                subtitle={`${formatGrams(mg, locale)} · ${portion.available ? S.gold.touchable : S.gold.untouchable}`}
                                onClick={() => openSheet('portion', { portion })}
                                right={<Money minor={value} currency={display} decimals="never" className="text-[16px]" />}
                            />
                        );
                    })}
                    <div className="p-4"><Button variant="dashed" icon={Plus} className="w-full" onClick={() => openSheet('portion')}>{S.gold.addPortion}</Button></div>
                </Panel>

                <Panel title={S.gold.performance} subtitle={S.gold.performanceIn(display)}>
                    <div className="grid grid-cols-2 gap-2">
                        {PERIODS.map(([key]) => {
                            const ratio = changes[key];
                            const effect = ratio === null ? null : Math.round(totalValue * ratio / (1 + ratio));
                            return (
                                <div key={key} className="border border-line bg-field p-3">
                                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{S.gold[key]}</p>
                                    <p className={cx('tabular mt-1 font-mono text-[22px] font-semibold', ratio === null ? 'text-dim' : ratio >= 0 ? 'text-neon' : 'text-hot')}>
                                        {ratio === null ? '—' : formatPercent(ratio, 2, { signed: true })}
                                    </p>
                                    {effect !== null && gold.totalMg > 0 && <p className={cx('tabular font-mono text-[13px]', effect >= 0 ? 'text-neon' : 'text-hot')}>{formatMoney(effect, display, { decimals: 'never', signed: true })}</p>}
                                </div>
                            );
                        })}
                    </div>
                    {gain && (
                        <div className="mt-4 border-t border-line pt-3 text-[14px]">
                            <p className="text-muted">{S.gold.gain}</p>
                            <p className="mt-1 font-mono text-white">
                                {S.gold.costBasis} {formatMoney(gain.cost, display, { decimals: 'never' })} → {formatMoney(gain.value, display, { decimals: 'never' })}{' '}
                                <span className={gain.gain >= 0 ? 'text-neon' : 'text-hot'}>({formatMoney(gain.gain, display, { decimals: 'never', signed: true })})</span>
                            </p>
                        </div>
                    )}
                </Panel>
            </div>

            <Panel title={S.gold.movesTitle} bare>
                {events.length === 0 && <Empty>{S.gold.noMoves}</Empty>}
                {events.map((event) => {
                    const portion = doc.portions?.[event.portionId];
                    const to = doc.portions?.[event.toPortionId];
                    return (
                        <Row
                            key={event.id}
                            icon={Coins}
                            iconTone={event.type === 'sell' ? 'hot' : 'gold'}
                            title={`${S.gold.events[event.type]} · ${formatGrams(event.mg, locale)}`}
                            subtitle={[formatDate(event.date, { year: true }), event.type === 'move' ? `${portion?.name} → ${to?.name}` : portion?.name, event.note].filter(Boolean).join(' · ')}
                            onClick={() => openSheet('gold', { event })}
                            right={event.price ? <Money minor={event.price} currency={event.currency} className="text-[15px]" /> : null}
                        />
                    );
                })}
            </Panel>

            <Panel title={S.gold.otherTitle} subtitle={S.gold.otherExplain} bare>
                {investmentAccounts.map((account) => (
                    <Row
                        key={account.id}
                        icon={PiggyBank}
                        iconTone="muted"
                        title={account.name}
                        subtitle={account.note || S.money.lockedTag}
                        onClick={() => openSheet('account', { account })}
                        right={<DualMoney minor={account.balance} currency={account.currency} display={display} displayMinor={account.display} />}
                    />
                ))}
                <div className="p-4"><Button variant="dashed" icon={Plus} className="w-full" onClick={() => openSheet('account', { kind: 'investment' })}>{S.gold.addInvestment}</Button></div>
            </Panel>
        </div>
    );
}
