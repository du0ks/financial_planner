import { useState } from 'react';
import { CreditCard, HandCoins, Plus, Settings2 } from 'lucide-react';
import { useModel } from '../state/hooks';
import { formatDate, nextDayOfMonth } from '../lib/dates';
import { convertOrZero } from '../lib/fx';
import {
    cardPreset, effectiveAnnualRate, effectiveMonthlyRate, minimumPayment, simulateAllCards, simulatePayoff,
} from '../lib/cards';
import { cardFees } from '../lib/insights';
import { debtAmount } from '../lib/model';
import { formatMoney, formatPercent, minorToInput, parseMoney, sumMinor } from '../lib/money';
import { AmountInput, Button, DualMoney, Empty, Field, Panel, Row, Stat, cx } from '../ui/kit';
import { openSheet } from '../ui/sheets';
import S from '../i18n/strings';

// Everything about what is owed: card interest and payoff, and debts with people. Loans would
// be one more section here, built the same way as a card (balance, terms, schedule).

export default function DebtsScreen() {
    const model = useModel();
    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="font-display text-[26px] font-bold text-white">{S.debts.title}</h1>
                <p className="mt-1 text-[15px] text-muted">{S.debts.subtitle}</p>
            </header>
            <Summary model={model} />
            <AllCards model={model} />
            {model.cards.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {model.cards.map((card) => <CardDebt key={card.id} card={card} model={model} />)}
                </div>
            )}
            <People model={model} />
        </div>
    );
}

const realRate = (terms) => (terms.monthlyRatePct ? effectiveMonthlyRate(terms.monthlyRatePct, terms.taxPct) : null);
const pct = (big, digits = 2) => formatPercent(Number(big.toString()), digits);

function Summary({ model }) {
    const { totals, display } = model;
    const money = (minor) => formatMoney(minor, display, { decimals: 'never' });
    return (
        <Panel>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label={S.debts.cards}><span className={cx('tabular font-mono', totals.totalCardDebt ? 'text-hot' : 'text-neon')}>{money(totals.totalCardDebt)}</span></Stat>
                <Stat label={S.debts.iOwe}><span className={cx('tabular font-mono', totals.iOweCertain ? 'text-hot' : 'text-white')}>{money(totals.iOweCertain)}</span></Stat>
                <Stat label={S.debts.possible}><span className="tabular font-mono text-dim">{money(totals.iOwePossible)}</span></Stat>
                <Stat label={S.debts.owedToMe}><span className="tabular font-mono text-neon">{money(totals.owedToMeAll)}</span></Stat>
            </div>
            {totals.totalCardDebt > 0 && (
                <p className="mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-3 text-[14px]">
                    <span className="text-muted">{S.debts.monthlyCost}</span>
                    <span className="tabular shrink-0 font-mono text-[16px] text-hot">{money(totals.cardInterestMonthly)}</span>
                </p>
            )}
        </Panel>
    );
}

/** Every card with debt in the display currency: which to pay first and how long it all takes. */
function AllCards({ model }) {
    const { cards, display, fx } = model;
    const owing = cards.filter((c) => c.debt > 0);
    const inDisplay = owing.map((c) => ({
        id: c.id,
        card: c,
        balance: c.debtDisplay,
        terms: { ...c.terms, minFloor: convertOrZero(c.terms.minFloor || 0, c.currency, display, fx) },
    }));
    const minimums = sumMinor(inDisplay.map((c) => minimumPayment(c.balance, c.terms)));
    const [text, setText] = useState(null);
    if (owing.length < 2) return null;

    const suggested = Math.ceil((minimums * 2) / 10000) * 10000;
    const amountText = text ?? minorToInput(suggested, display);
    const monthly = parseMoney(amountText, display) || 0;
    const plan = simulateAllCards({ cards: inDisplay, monthly });
    const minimumsOnly = sumMinor(inDisplay.map((c) => simulatePayoff({ balance: c.balance, terms: c.terms, strategy: { type: 'minimum' } }).interest || 0));
    const first = plan.order[0];
    const unrated = plan.order.filter((c) => !c.terms.monthlyRatePct).map((c) => c.card.name);
    const money = (minor) => formatMoney(minor, display, { decimals: 'never' });

    return (
        <Panel title={S.debts.allCardsTitle} subtitle={S.debts.allCardsExplain(display)} tone="hot">
            {first?.terms.monthlyRatePct && <p className="mb-3 text-[15px] leading-snug text-white">{S.debts.payFirst(first.card.name, pct(realRate(first.terms)))}</p>}
            <ol className="flex flex-col">
                {plan.order.map((c, i) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0">
                        <span className="min-w-0 text-[15px] text-body">
                            <span className="mr-2 font-mono text-dim">{i + 1}.</span>{c.card.name}
                            <span className="ml-2 font-mono text-[12px] text-dim">{c.terms.monthlyRatePct ? S.debts.perMonth(pct(realRate(c.terms))) : '—'}</span>
                        </span>
                        <span className="shrink-0 text-right">
                            <span className="tabular block font-mono text-[15px] text-hot">{money(c.balance)}</span>
                            {plan.paidOffIn[c.id] && <span className="block font-mono text-[11px] text-dim">{S.debts.clearedIn(plan.paidOffIn[c.id])}</span>}
                        </span>
                    </li>
                ))}
            </ol>
            {unrated.length > 0 && <p className="mt-2 text-[13px] text-gold">{S.debts.noRate(unrated.join(', '))}</p>}
            <Field label={S.debts.monthly} className="mt-4">
                <AmountInput value={amountText} onChange={setText} currency={display} />
            </Field>
            <div className="mt-3 text-[14px] leading-snug">
                {plan.short && <p className="text-gold">{S.debts.short(money(minimums))}</p>}
                {plan.paidOff
                    ? <p className="text-white">{S.debts.result(S.card.months(plan.months), money(plan.interest))}</p>
                    : <p className="text-hot">{S.debts.never}</p>}
                {minimumsOnly > 0 && <p className="mt-1 text-dim">{S.debts.vsMinimum(money(minimumsOnly))}</p>}
            </div>
        </Panel>
    );
}

function CardDebt({ card, model }) {
    const { doc, today } = model;
    const { terms } = card;
    const [fixedText, setFixedText] = useState(minorToInput(Math.round(card.debt / 4 / 100) * 100, card.currency));
    const money = (minor) => formatMoney(minor, card.currency, { decimals: 'never' });
    const monthly = realRate(terms);
    const fees = (from) => cardFees(doc, from, today, card.currency, model.fx, { accountId: card.id });
    const fixed = parseMoney(fixedText, card.currency) || 0;
    const sims = monthly && card.debt > 0 ? [
        [S.card.strategyFull, simulatePayoff({ balance: card.debt, terms, strategy: { type: 'full' } })],
        [S.card.strategyMinimum(terms.minPct), simulatePayoff({ balance: card.debt, terms, strategy: { type: 'minimum' } })],
        [`${S.card.strategyFixed}: ${money(fixed)}`, simulatePayoff({ balance: card.debt, terms, strategy: { type: 'fixed', amount: fixed } })],
    ] : [];
    const editTerms = () => openSheet('cardTerms', { card });

    return (
        <section className={cx('border bg-panel', card.debt > 0 ? 'border-hot/35' : 'border-line')}>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center border', card.debt > 0 ? 'border-hot/60 bg-hot/10 text-hot' : 'border-neon/60 bg-neon/10 text-neon')}><CreditCard size={17} /></span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[18px] font-semibold text-white">{card.name}</span>
                    <span className="block text-[12px] text-dim">{S.card.presets[cardPreset(card)]} · {card.currency}</span>
                </span>
                <DualMoney minor={card.debt} currency={card.currency} display={model.display} displayMinor={card.debtDisplay} tone={card.debt ? 'hot' : 'neon'} decimals="never" />
            </header>
            <div className="flex flex-col gap-4 p-4">
                {monthly ? (
                    <div className="text-[14px] leading-snug text-body">
                        <p>{S.card.terms(terms.monthlyRatePct, terms.interestBase, terms.taxPct)}</p>
                        <p className="text-muted">
                            {S.card.effective(pct(monthly), pct(effectiveAnnualRate(monthly), 0))}
                            {card.rateConfirmed === false && <span className="text-gold"> · {S.card.rateAssumed}</span>}
                        </p>
                    </div>
                ) : <p className="text-[14px] text-dim">{S.card.noRate}</p>}
                {card.statementDay && card.dueDay && (
                    <p className="text-[13px] text-dim">{S.card.nextDates(formatDate(nextDayOfMonth(today, card.statementDay)), formatDate(nextDayOfMonth(today, card.dueDay)))}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                    <Stat label={S.card.recordedMonth}><span className="tabular font-mono text-[16px] text-hot">{money(fees(`${today.slice(0, 7)}-01`))}</span></Stat>
                    <Stat label={S.card.recordedYear}><span className="tabular font-mono text-[16px] text-hot">{money(fees(`${today.slice(0, 4)}-01-01`))}</span></Stat>
                    <Stat label={S.card.interestNextShort}><span className="tabular font-mono text-[16px] text-hot">{card.interestMonthly === null ? '—' : money(card.interestMonthly)}</span></Stat>
                </div>

                {sims.length > 0 && (
                    <div className="border-t border-line pt-3">
                        <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{S.card.simulator}</p>
                        <Field label={S.card.fixedAmount}>
                            <AmountInput value={fixedText} onChange={setFixedText} currency={card.currency} />
                        </Field>
                        <div className="mt-2 flex flex-col">
                            {sims.map(([label, result]) => (
                                <div key={label} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                                    <span className="text-[14px] text-body">
                                        {label}
                                        {result.belowMinimum && <span className="mt-0.5 block text-[12px] text-gold">{S.card.belowMinimum}</span>}
                                    </span>
                                    <span className="shrink-0 text-right">
                                        {result.paidOff ? (
                                            <>
                                                <span className="block font-mono text-[15px] text-white">{S.card.months(result.months)}</span>
                                                <span className={cx('block font-mono text-[13px]', result.interest ? 'text-hot' : 'text-neon')}>{S.card.totalInterest(money(result.interest))}</span>
                                            </>
                                        ) : <span className="block max-w-[160px] text-[13px] text-hot">{S.card.never}</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={monthly ? 'outline' : 'primary'} icon={Settings2} onClick={editTerms}>{monthly ? S.card.editTerms : S.card.setTerms}</Button>
                    {card.debt > 0 && (
                        <Button size="sm" icon={HandCoins} onClick={() => openSheet('tx', { preset: { type: 'transfer', accountId: card.linkedAccountId || null, toAccountId: card.id, amount: card.debt, currency: card.currency } })}>{S.money.pay}</Button>
                    )}
                    <Button size="sm" icon={Plus} onClick={() => openSheet('tx', { preset: { type: 'expense', accountId: card.id, categoryId: 'cat_fees', currency: card.currency } })}>{S.debts.addFees}</Button>
                </div>
            </div>
        </section>
    );
}

/** Debts with people: add, edit, resolve and delete. */
function People({ model }) {
    const { debts, display, doc, settings } = model;
    // I owe: someone else paid. Owed to me: I paid from one of my accounts.
    const add = (direction) => openSheet('tx', {
        preset: {
            type: 'expense',
            currency: settings.spendingCurrency,
            ...(direction === 'iOwe' ? { accountId: null } : {}),
            debt: { direction, certainty: direction === 'iOwe' ? 'possible' : 'certain', status: 'open' },
        },
    });
    return (
        <Panel title={S.debts.personalTitle} subtitle={S.debts.personalExplain} bare>
            {debts.length === 0 && <Empty>{S.debts.none}</Empty>}
            {debts.map((tx) => {
                const iOwe = tx.debt.direction === 'iOwe';
                const label = iOwe ? (tx.debt.certainty === 'possible' ? S.money.iOwe : S.money.iOweCertain) : S.money.owedToMe;
                return (
                    <Row
                        key={tx.id}
                        icon={HandCoins}
                        iconTone={iOwe ? (tx.debt.certainty === 'possible' ? 'muted' : 'hot') : 'neon'}
                        title={tx.note || doc.categories?.[tx.categoryId]?.name || label}
                        subtitle={`${label}${tx.debt.who ? ` · ${tx.debt.who}` : ''} · ${formatDate(tx.date)}`}
                        onClick={() => openSheet('debt', { tx })}
                        right={<DualMoney minor={debtAmount(tx)} currency={tx.currency} display={display} displayMinor={tx.display} tone={iOwe ? (tx.debt.certainty === 'possible' ? 'muted' : 'hot') : 'neon'} />}
                    />
                );
            })}
            <div className="grid grid-cols-2 gap-2 p-4">
                <Button variant="dashed" icon={Plus} onClick={() => add('iOwe')}>{S.debts.addIOwe}</Button>
                <Button variant="dashed" icon={Plus} onClick={() => add('owedToMe')}>{S.debts.addOwedToMe}</Button>
            </div>
        </Panel>
    );
}
