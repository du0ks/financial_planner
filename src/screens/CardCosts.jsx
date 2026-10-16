import { useState } from 'react';
import { useModel } from '../state/hooks';
import { simulatePayoff, DEFAULT_MIN_PAYMENT_PCT } from '../lib/cards';
import { cardFees } from '../lib/insights';
import { formatMoney, minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Field, Panel, Select, Stat, cx } from '../ui/kit';
import S from '../i18n/strings';

/** Interest paid so far and what clearing each card's debt costs under different payments. */
export default function CardCosts() {
    const model = useModel();
    const { cards, doc, today } = model;
    const relevant = cards.filter((c) => c.debt > 0 || c.monthlyRate);
    const [cardId, setCardId] = useState(relevant.find((c) => c.debt > 0)?.id || relevant[0]?.id || '');
    const card = relevant.find((c) => c.id === cardId) || relevant[0];
    const [fixedText, setFixedText] = useState(card ? minorToInput(Math.round(card.debt / 4 / 100) * 100, card.currency) : '');
    if (!card) return null;

    const year = today.slice(0, 4);
    const month = today.slice(0, 7);
    const fees = (from) => cardFees(doc, from, today, card.currency, model.fx, { accountId: card.id });
    const fixed = parseMoney(fixedText, card.currency) || 0;
    const rate = card.monthlyRate;
    const sims = rate && card.debt > 0 ? [
        [S.card.strategyFull, simulatePayoff({ balance: card.debt, monthlyRatePct: rate, taxPct: card.taxRate, strategy: { type: 'full' } })],
        [S.card.strategyMinimum(card.minPaymentPct || DEFAULT_MIN_PAYMENT_PCT), simulatePayoff({ balance: card.debt, monthlyRatePct: rate, taxPct: card.taxRate, strategy: { type: 'minimum', pct: card.minPaymentPct || DEFAULT_MIN_PAYMENT_PCT } })],
        [`${S.card.strategyFixed}: ${formatMoney(fixed, card.currency, { decimals: 'never' })}`, simulatePayoff({ balance: card.debt, monthlyRatePct: rate, taxPct: card.taxRate, strategy: { type: 'fixed', amount: fixed } })],
    ] : [];

    return (
        <Panel title={S.card.simulator} subtitle={S.card.simulatorExplain}>
            <div className="flex flex-col gap-4">
                {relevant.length > 1 && (
                    <Select value={card.id} onChange={(id) => { setCardId(id); const c = relevant.find((x) => x.id === id); setFixedText(minorToInput(Math.round(c.debt / 4 / 100) * 100, c.currency)); }} options={relevant.map((c) => ({ value: c.id, label: `${c.name} · ${formatMoney(c.debt, c.currency, { decimals: 'never' })}` }))} />
                )}
                <div className="grid grid-cols-2 gap-2">
                    <Stat label={S.card.interestMonth}><span className="tabular font-mono text-hot">{formatMoney(fees(`${month}-01`), card.currency, { decimals: 'never' })}</span></Stat>
                    <Stat label={S.card.interestYear}><span className="tabular font-mono text-hot">{formatMoney(fees(`${year}-01-01`), card.currency, { decimals: 'never' })}</span></Stat>
                </div>
                {!rate && <p className="text-[14px] text-dim">{S.card.noRate}</p>}
                {sims.length > 0 && (
                    <>
                        <Field label={S.card.fixedAmount}>
                            <AmountInput value={fixedText} onChange={setFixedText} currency={card.currency} />
                        </Field>
                        <div className="flex flex-col">
                            {sims.map(([label, result]) => (
                                <div key={label} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                                    <span className="text-[14px] text-body">{label}</span>
                                    <span className="text-right">
                                        {result.paidOff ? (
                                            <>
                                                <span className="block font-mono text-[15px] text-white">{S.card.months(result.months)}</span>
                                                <span className={cx('block font-mono text-[13px]', result.interest ? 'text-hot' : 'text-neon')}>{S.card.totalInterest(formatMoney(result.interest, card.currency, { decimals: 'never' }))}</span>
                                            </>
                                        ) : <span className="block max-w-[180px] text-[13px] text-hot">{S.card.never}</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </Panel>
    );
}
