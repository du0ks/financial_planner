import { useState } from 'react';
import { Camera, CreditCard, HandCoins, Plus, Repeat, AlertTriangle } from 'lucide-react';
import { useModel } from '../state/hooks';
import { saveSnapshot } from '../state/actions';
import { list } from '../lib/doc';
import { daysBetween, formatDate } from '../lib/dates';
import { effectiveAnnualRate, effectiveMonthlyRate, monthlyInterest } from '../lib/cards';
import { pendingOccurrences } from '../lib/ledger';
import { debtAmount } from '../lib/model';
import { formatMoney, formatPercent } from '../lib/money';
import { Bar, Button, DualMoney, Empty, Money, Panel, Row, cx, toast } from '../ui/kit';
import { accountIcon } from '../ui/icons';
import { openSheet } from '../ui/sheets';
import S from '../i18n/strings';

export default function MoneyScreen() {
    const model = useModel();
    return (
        <div className="flex flex-col gap-6">
            <Hero model={model} />
            <Waiting model={model} />
            <Cards model={model} />
            <Accounts model={model} />
            <Debts model={model} />
            <SnapshotFooter model={model} />
        </div>
    );
}

function Hero({ model }) {
    const [open, setOpen] = useState(false);
    const { totals, display, bills, gold } = model;
    const line = (label, minor, tone, sign = '') => (
        <div className="flex items-baseline justify-between gap-4 py-1.5">
            <span className="text-[14px] text-muted">{label}</span>
            <span className={cx('tabular font-mono text-[15px]', tone)}>{sign}{formatMoney(Math.abs(minor), display, { decimals: 'never' })}</span>
        </div>
    );
    return (
        <section className="relative overflow-hidden border border-neon/30 bg-gradient-to-b from-[#0d0a1e] to-[#07050e] p-5 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted">{S.money.heroLabel}</p>
                    <p className={cx('tabular mt-3 font-display text-[46px] font-extrabold leading-none tracking-tight md:text-[80px]', totals.availableNow < 0 ? 'text-hot' : 'text-white')}>
                        {formatMoney(totals.availableNow, display, { decimals: 'never' })}
                    </p>
                    <p className="mt-4 max-w-xl text-[15px] leading-snug text-body">{S.money.heroExplain}</p>
                </div>
                <div className="shrink-0 md:text-right">
                    <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">{S.money.netWorth}</p>
                    <p className="tabular mt-1 font-mono text-[28px] font-semibold text-neon md:text-[34px]">{formatMoney(totals.netWorth, display, { decimals: 'never' })}</p>
                    <p className="mt-1 max-w-[280px] text-[13px] leading-snug text-dim md:ml-auto">{S.money.netWorthExplain}</p>
                </div>
            </div>

            {model.missing.length > 0 && (
                <p className="mt-4 flex items-start gap-2 text-[14px] text-gold"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{S.common.ratesMissing(model.missing.join(', '))}</p>
            )}

            <button type="button" onClick={() => setOpen(!open)} className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] text-neon">
                {open ? S.money.hideBreakdown : S.money.breakdown}
            </button>
            {open && (
                <div className="mt-3 max-w-md border-t border-line pt-2">
                    {line(S.money.lines.cash, totals.availableCash, 'text-white')}
                    {gold.availableMg > 0 && line(S.money.lines.gold, gold.availableValue, 'text-gold', '+ ')}
                    {line(S.money.lines.cards, totals.totalCardDebt, 'text-hot', '− ')}
                    {line(S.money.lines.bills(bills.payday ? formatDate(bills.payday) : null), bills.total, 'text-hot', '− ')}
                    {totals.iOweCertain > 0 && line(S.money.lines.debts, totals.iOweCertain, 'text-hot', '− ')}
                    <div className="mt-1 border-t border-line pt-1">{line(S.money.lines.result, totals.availableNow, 'text-white font-semibold')}</div>
                    {totals.iOwePossible > 0 && line(S.money.lines.possible, totals.iOwePossible, 'text-dim')}
                </div>
            )}
        </section>
    );
}

/** Recurring items waiting for a tap: bills before payday, and income that should have arrived. */
function Waiting({ model }) {
    const { doc, today, display, bills } = model;
    const income = pendingOccurrences(doc, `${today.slice(0, 7)}-01`, today, { type: 'income' });
    const items = [...income, ...bills.items].sort((a, b) => a.date.localeCompare(b.date));
    if (!items.length && !list(doc, 'rules').length) return null;
    return (
        <Panel title={S.money.billsTitle} subtitle={S.money.billsExplain} bare>
            {items.length === 0 && <Empty>{S.money.noBills}</Empty>}
            {items.map((o) => (
                <Row
                    key={`${o.rule.id}-${o.month}`}
                    icon={Repeat}
                    iconTone={o.rule.type === 'income' ? 'neon' : 'hot'}
                    title={o.rule.name}
                    subtitle={`${formatDate(o.date)} · ${S.common.inDays(daysBetween(today, o.date))}`}
                    onClick={() => openSheet('confirm', { occurrence: o })}
                    right={<DualMoney minor={o.rule.amount} currency={o.rule.currency} display={display} displayMinor={model.toDisplay(o.rule.amount, o.rule.currency)} tone={o.rule.type === 'income' ? 'neon' : 'hot'} />}
                />
            ))}
        </Panel>
    );
}

function Cards({ model }) {
    const { cards, display, totals } = model;
    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="max-w-2xl">
                    <h2 className="font-display text-[22px] font-bold text-white">{S.money.cardsTitle}</h2>
                    <p className="mt-1 text-[14px] leading-snug text-muted">{S.money.cardsExplain}</p>
                </div>
                <div className="text-right">
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{S.money.cardsTotal}</p>
                    <Money minor={totals.totalCardDebt} currency={display} decimals="never" tone={totals.totalCardDebt ? 'hot' : 'neon'} className="text-[24px] font-semibold" />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {cards.map((card) => <CardPanel key={card.id} card={card} model={model} />)}
                <Button variant="dashed" icon={Plus} className="min-h-14" onClick={() => openSheet('card')}>{S.money.addCard}</Button>
            </div>
        </section>
    );
}

function CardPanel({ card, model }) {
    const { display } = model;
    const deposit = card.deposit;
    const bankNet = (deposit && deposit.currency === card.currency ? deposit.balance : 0) - card.debt;
    const used = card.limit > 0 ? card.debt / card.limit : 0;
    const monthly = card.monthlyRate ? effectiveMonthlyRate(card.monthlyRate, card.taxRate) : null;
    const interest = monthly && card.debt > 0 ? monthlyInterest(card.debt, card.monthlyRate, card.taxRate) : 0;
    const cell = (label, minor, tone, onClick) => (
        <button type="button" onClick={onClick} className="flex flex-col items-start gap-1 border border-line bg-field p-2.5 text-left">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{label}</span>
            <Money minor={minor} currency={card.currency} tone={tone} className="text-[16px]" />
        </button>
    );
    const edit = () => openSheet('card', { card });
    return (
        <div className={cx('border bg-panel', card.debt > 0 ? 'border-hot/35' : 'border-line')}>
            <button type="button" onClick={edit} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left">
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center border', card.debt > 0 ? 'border-hot/60 bg-hot/10 text-hot' : 'border-neon/60 bg-neon/10 text-neon')}>
                    <CreditCard size={17} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[18px] font-semibold text-white">{card.name}</span>
                    <span className="block text-[12px] text-dim">{deposit ? S.money.bankNet : S.money.noDeposit}</span>
                </span>
                {deposit && (
                    <DualMoney
                        minor={bankNet}
                        currency={card.currency}
                        display={display}
                        displayMinor={model.toDisplay(bankNet, card.currency)}
                        tone={bankNet < 0 ? 'hot' : 'neon'}
                        decimals="never"
                    />
                )}
            </button>
            <div className="px-4 pt-3">
                <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="font-mono uppercase tracking-[0.08em] text-muted">{S.money.limitUsed}</span>
                    <span className="tabular font-mono text-white">{card.debt > 0 ? `${formatMoney(card.debt, card.currency, { decimals: 'never' })} / ${formatMoney(card.limit, card.currency, { decimals: 'never' })}` : S.money.nothingUsed}</span>
                </div>
                <Bar ratio={used} tone={card.debt > 0 ? 'hot' : 'neon'} />
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                {cell(S.money.limit, card.limit || 0, null, edit)}
                {cell(S.money.inAccount, deposit?.balance || 0, 'neon', deposit ? () => openSheet('account', { account: deposit }) : edit)}
                {cell(S.money.debtNow, card.debt, card.debt ? 'hot' : null, edit)}
                {cell(S.money.leftToSpend, card.leftToSpend, 'neon', edit)}
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4">
                {monthly ? (
                    <p className="text-[13px] leading-snug text-muted">
                        {S.card.effective(formatPercent(Number(monthly.toString()), 2), formatPercent(Number(effectiveAnnualRate(monthly).toString()), 0))}
                        {card.rateConfirmed === false && <span className="text-gold"> · {S.card.rateAssumed}</span>}
                        {interest > 0 && <span className="text-hot"> · ≈ {formatMoney(interest, card.currency, { decimals: 'never' })}/mo</span>}
                    </p>
                ) : card.debt > 0 && <p className="text-[13px] text-dim">{S.card.noRate}</p>}
                {card.dueDay && <p className="text-[13px] text-dim">{S.money.statementDue(card.dueDay)}</p>}
                <div className="flex flex-wrap gap-2">
                    {card.debt > 0 && (
                        <Button size="sm" variant="primary" icon={HandCoins} onClick={() => openSheet('tx', { preset: { type: 'transfer', accountId: card.linkedAccountId || null, toAccountId: card.id, amount: card.debt, currency: card.currency } })}>
                            {S.money.pay}
                        </Button>
                    )}
                    <Button size="sm" onClick={() => openSheet('tx', { preset: { type: 'expense', accountId: card.id, categoryId: 'cat_fees', currency: card.currency } })}>{S.money.interest}</Button>
                </div>
            </div>
        </div>
    );
}

function Accounts({ model }) {
    const { cashAccounts, investmentAccounts, display } = model;
    const row = (account) => (
        <Row
            key={account.id}
            icon={accountIcon(account)}
            iconTone={account.available === false ? 'muted' : 'neon'}
            title={account.name}
            subtitle={account.available === false ? `${S.money.lockedTag}${account.note ? ` · ${account.note}` : ''}` : account.note || S.kinds[account.kind]}
            onClick={() => openSheet('account', { account })}
            right={<DualMoney minor={account.balance} currency={account.currency} display={display} displayMinor={account.display} tone={account.balance < 0 ? 'hot' : null} />}
        />
    );
    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title={S.money.accountsTitle} subtitle={S.money.accountsExplain} bare>
                {cashAccounts.length === 0 && <Empty>{S.common.noneYet}</Empty>}
                {cashAccounts.map(row)}
                <div className="p-4"><Button variant="dashed" icon={Plus} className="w-full" onClick={() => openSheet('account')}>{S.money.addAccount}</Button></div>
            </Panel>
            {investmentAccounts.length > 0 && (
                <Panel title={S.money.investmentsTitle} bare>
                    {investmentAccounts.map(row)}
                </Panel>
            )}
        </div>
    );
}

function Debts({ model }) {
    const { debts, display, doc } = model;
    if (!debts.length) return null;
    return (
        <Panel title={S.money.debtsTitle} bare>
            {debts.map((tx) => {
                const iOwe = tx.debt.direction === 'iOwe';
                const label = iOwe ? (tx.debt.certainty === 'possible' ? S.money.iOwe : S.money.iOweCertain) : S.money.owedToMe;
                return (
                    <Row
                        key={tx.id}
                        icon={HandCoins}
                        iconTone={iOwe ? 'hot' : 'neon'}
                        title={tx.note || doc.categories?.[tx.categoryId]?.name || label}
                        subtitle={`${label}${tx.debt.who ? ` · ${tx.debt.who}` : ''} · ${formatDate(tx.date)}`}
                        onClick={() => openSheet('debt', { tx })}
                        right={<DualMoney minor={debtAmount(tx)} currency={tx.currency} display={display} displayMinor={tx.display} tone={iOwe ? 'hot' : 'neon'} />}
                    />
                );
            })}
        </Panel>
    );
}

function SnapshotFooter({ model }) {
    const latest = list(model.doc, 'snapshots').sort((a, b) => b.date.localeCompare(a.date))[0];
    const days = latest ? daysBetween(latest.date.slice(0, 10), model.today) : null;
    return (
        <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
            <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-dim">{S.money.lastSnapshot(days)}</span>
            <Button variant="primary" size="lg" icon={Camera} onClick={() => { saveSnapshot(model); toast(S.money.snapshotSaved); }}>{S.money.snapshot}</Button>
        </div>
    );
}
