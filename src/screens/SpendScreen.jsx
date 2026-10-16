import { useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Repeat, Search, Upload } from 'lucide-react';
import { useModel } from '../state/hooks';
import { list } from '../lib/doc';
import { addMonths, formatDate, formatMonth, monthOf } from '../lib/dates';
import { isIncome, isSpending, occurrencesIn, txAmountIn } from '../lib/ledger';
import { formatMoney, sumMinor } from '../lib/money';
import { Button, Chips, Empty, IconButton, Money, Panel, Row, Select, cx } from '../ui/kit';
import { categoryIcon } from '../ui/icons';
import { openSheet } from '../ui/sheets';
import S from '../i18n/strings';

export default function SpendScreen() {
    const model = useModel();
    const { doc, display, fx, today, accountsById } = model;
    const [month, setMonth] = useState(monthOf(today));
    const [type, setType] = useState('all');
    const [categoryId, setCategoryId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [query, setQuery] = useState('');

    const categories = useMemo(() => list(doc, 'categories').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [doc]);
    const monthTx = useMemo(() => list(doc, 'tx').filter((tx) => monthOf(tx.date) === month && !tx.skipped), [doc, month]);
    const spent = sumMinor(monthTx.filter(isSpending).map((tx) => txAmountIn(tx, display, doc, fx)));
    const came = sumMinor(monthTx.filter(isIncome).map((tx) => txAmountIn(tx, display, doc, fx)));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return monthTx
            .filter((tx) => type === 'all' || tx.type === type)
            .filter((tx) => !categoryId || tx.categoryId === categoryId)
            .filter((tx) => !accountId || tx.accountId === accountId || tx.toAccountId === accountId)
            .filter((tx) => {
                if (!q) return true;
                const hay = [tx.note, doc.categories?.[tx.categoryId]?.name, accountsById[tx.accountId]?.name, tx.debt?.who, formatMoney(tx.amount, tx.currency)].join(' ').toLowerCase();
                return hay.includes(q) || String(tx.amount / 100).includes(q);
            })
            .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    }, [monthTx, type, categoryId, accountId, query, doc, accountsById]);

    const byDay = useMemo(() => {
        const groups = [];
        for (const tx of filtered) {
            const last = groups[groups.length - 1];
            if (last && last.date === tx.date) last.items.push(tx);
            else groups.push({ date: tx.date, items: [tx] });
        }
        return groups;
    }, [filtered]);

    const occurrences = occurrencesIn(doc, month);
    const filtering = type !== 'all' || categoryId || accountId || query;

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth(addMonths(month, -1))} />
                    <h1 className="min-w-[120px] text-center font-display text-[22px] font-bold text-white">{formatMonth(month)}</h1>
                    <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth(addMonths(month, 1))} />
                </div>
                <Button size="sm" icon={Upload} onClick={() => openSheet('import')}>{S.spend.import}</Button>
            </header>

            <div className="grid grid-cols-2 gap-3">
                <div className="border border-hot/30 bg-panel p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{S.spend.monthTotal}</p>
                    <Money minor={spent} currency={display} decimals="never" tone="hot" className="mt-1 block text-[24px] font-semibold" />
                </div>
                <div className="border border-neon/30 bg-panel p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{S.spend.monthIncome}</p>
                    <Money minor={came} currency={display} decimals="never" tone="neon" className="mt-1 block text-[24px] font-semibold" />
                </div>
            </div>

            {occurrences.length > 0 && (
                <Panel title={S.spend.toConfirm} bare>
                    {occurrences.map((o) => (
                        <Row
                            key={o.rule.id}
                            icon={Repeat}
                            iconTone={o.done ? 'muted' : o.rule.type === 'income' ? 'neon' : 'hot'}
                            title={o.rule.name}
                            subtitle={`${formatDate(o.date)}${o.done ? ` · ${o.tx.skipped ? S.spend.skipped : S.spend.confirmed}` : ''}`}
                            onClick={() => openSheet('confirm', { occurrence: o })}
                            right={<Money minor={o.done && !o.tx.skipped ? o.tx.amount : o.rule.amount} currency={o.rule.currency} tone={o.done ? 'muted' : null} className={cx('text-[16px]', o.tx?.skipped && 'line-through')} />}
                        />
                    ))}
                </Panel>
            )}

            <div className="flex flex-col gap-3">
                <div className="flex h-12 items-center gap-2 border border-line-strong bg-field px-3 focus-within:border-neon">
                    <Search size={17} className="text-dim" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={S.spend.searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent text-white outline-none" />
                </div>
                <Chips
                    value={type}
                    onChange={setType}
                    options={[{ value: 'all', label: S.spend.allTypes }, ...['expense', 'income', 'transfer'].map((value) => ({ value, label: S.tx.types[value] }))]}
                />
                <div className="grid grid-cols-2 gap-2">
                    <Select value={categoryId} onChange={setCategoryId} options={[{ value: '', label: S.spend.allCategories }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                    <Select value={accountId} onChange={setAccountId} options={[{ value: '', label: S.spend.allAccounts }, ...model.accounts.map((a) => ({ value: a.id, label: a.name }))]} />
                </div>
                {filtering && (
                    <button type="button" className="self-start font-mono text-[12px] uppercase tracking-[0.08em] text-neon" onClick={() => { setType('all'); setCategoryId(''); setAccountId(''); setQuery(''); }}>
                        {S.spend.clearFilters}
                    </button>
                )}
            </div>

            <div className="border border-line bg-panel">
                {byDay.length === 0 && <Empty>{S.spend.empty}</Empty>}
                {byDay.map((group) => (
                    <div key={group.date}>
                        <p className="border-t border-line bg-field px-4 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted first:border-t-0 md:px-5">
                            {group.date === today ? S.common.today : formatDate(group.date)}
                        </p>
                        {group.items.map((tx) => <TxRow key={tx.id} tx={tx} model={model} />)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TxRow({ tx, model }) {
    const { doc, accountsById, display, fx } = model;
    const category = doc.categories?.[tx.categoryId];
    const from = accountsById[tx.accountId];
    const to = accountsById[tx.toAccountId];
    const transfer = tx.type === 'transfer';
    const income = tx.type === 'income';
    const title = transfer ? `${from?.name || '?'} → ${to?.name || '?'}` : tx.note || category?.name || S.tx.types[tx.type];
    const parts = [];
    if (!transfer && tx.note && category) parts.push(category.name);
    if (!transfer) parts.push(from ? from.name : tx.type === 'expense' ? S.tx.paidByOther : '');
    if (tx.debt) parts.push(tx.debt.status === 'open' ? (tx.debt.direction === 'iOwe' ? S.money.iOwe : S.money.owedToMe) : tx.debt.status === 'settled' ? S.tx.settledTag : S.tx.cancelledTag);
    if (tx.ruleId || tx.recurring) parts.push(S.tx.recurring);
    const others = tx.currency === display ? [] : [...new Set([display, ...model.settings.currencies])].filter((c) => c !== tx.currency).slice(0, 2);
    const converted = others.map((code) => S.common.approx(formatMoney(txAmountIn(tx, code, doc, fx), code, { decimals: 'never' }))).join(' · ');
    return (
        <Row
            icon={transfer ? ArrowLeftRight : categoryIcon(category)}
            iconTone={transfer ? 'muted' : income ? 'neon' : 'hot'}
            title={title}
            subtitle={parts.filter(Boolean).join(' · ')}
            onClick={() => openSheet('tx', { tx })}
            right={(
                <span className="flex flex-col items-end leading-tight">
                    <span className={cx('tabular font-mono text-[16px]', transfer ? 'text-muted' : income ? 'text-neon' : 'text-white')}>
                        {income ? '+' : transfer ? '' : '−'}{formatMoney(tx.amount, tx.currency)}
                    </span>
                    {converted && <span className="tabular font-mono text-[12px] text-dim">{converted}</span>}
                </span>
            )}
        />
    );
}
