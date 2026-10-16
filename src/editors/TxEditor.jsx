import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useModel } from '../state/hooks';
import { deleteTx, saveTx } from '../state/actions';
import { list } from '../lib/doc';
import { addDays } from '../lib/dates';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Chips, DateInput, Field, Segmented, Sheet, SheetActions, Select, TextInput, Toggle, toast } from '../ui/kit';
import { accountIcon, categoryIcon } from '../ui/icons';
import S from '../i18n/strings';

const LAST_ACCOUNT_KEY = 'pv5-last-account:';
const readLast = (type) => { try { return window.localStorage.getItem(LAST_ACCOUNT_KEY + type); } catch { return null; } };
const writeLast = (type, id) => { try { window.localStorage.setItem(LAST_ACCOUNT_KEY + type, id || ''); } catch { /* ignore */ } };

/** Categories ordered by how often they were used lately, so the usual ones come first. */
function useCategoryOptions(doc, income) {
    return useMemo(() => {
        const counts = {};
        const recent = list(doc, 'tx').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
        for (const tx of recent) counts[tx.categoryId] = (counts[tx.categoryId] || 0) + 1;
        return list(doc, 'categories')
            .filter((c) => Boolean(c.income) === income && !c.system)
            .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || (a.order ?? 0) - (b.order ?? 0));
    }, [doc, income]);
}

export default function TxEditor({ tx, preset = {}, onClose }) {
    const model = useModel();
    const { doc, settings, accounts, today } = model;
    const editing = Boolean(tx);
    const base = tx || preset;

    const [type, setType] = useState(base.type || 'expense');
    const [currency, setCurrency] = useState(base.currency || settings.spendingCurrency);
    const [amountText, setAmountText] = useState(base.amount ? minorToInput(base.amount, base.currency || settings.spendingCurrency) : '');
    const [categoryId, setCategoryId] = useState(base.categoryId || null);
    const usable = accounts.filter((a) => a.kind !== 'investment' || type === 'transfer');
    const defaultAccount = () => {
        if ('accountId' in base) return base.accountId;
        const last = readLast(type);
        if (last && usable.some((a) => a.id === last)) return last;
        return usable.find((a) => a.currency === currency && a.kind !== 'credit')?.id || usable[0]?.id || null;
    };
    const [accountId, setAccountId] = useState(defaultAccount);
    const [toAccountId, setToAccountId] = useState(base.toAccountId || accounts.find((a) => a.id !== accountId)?.id || null);
    const [toAmountText, setToAmountText] = useState(base.toAmount ? minorToInput(base.toAmount, accounts.find((a) => a.id === base.toAccountId)?.currency || currency) : '');
    const [date, setDate] = useState(base.date || today);
    const [note, setNote] = useState(base.note || '');
    const [recurring, setRecurring] = useState(Boolean(base.recurring));
    const [debt, setDebt] = useState(base.debt || null);
    const [more, setMore] = useState(Boolean(base.debt || base.recurring));
    const [error, setError] = useState(null);
    const amountRef = useRef(null);
    const fail = (message) => {
        setError(message);
        amountRef.current?.scrollIntoView({ block: 'center' });
        amountRef.current?.focus();
    };

    const categories = useCategoryOptions(doc, type === 'income');
    const fromAccount = accounts.find((a) => a.id === accountId);
    const toAccount = accounts.find((a) => a.id === toAccountId);
    const txCurrency = type === 'transfer' ? fromAccount?.currency || currency : currency;
    const crossCurrency = type === 'transfer' && fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

    const changeType = (next) => {
        setType(next);
        if (next === 'transfer' && !accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id || null);
        if (next !== 'expense') setDebt(null);
    };

    const save = () => {
        const amount = parseMoney(amountText, txCurrency);
        if (!amount || amount <= 0) { fail(S.common.invalidAmount); return; }
        let toAmount;
        if (crossCurrency && toAmountText.trim()) {
            toAmount = parseMoney(toAmountText, toAccount.currency);
            if (!toAmount || toAmount <= 0) { fail(S.common.invalidAmount); return; }
        }
        const record = {
            ...(tx || {}),
            type,
            amount,
            currency: txCurrency,
            date,
            note: note.trim(),
            accountId: type === 'transfer' ? accountId : accountId || null,
            toAccountId: type === 'transfer' ? toAccountId : null,
            toAmount: crossCurrency ? toAmount ?? null : null,
            categoryId: type === 'transfer' ? null : categoryId || (type === 'income' ? 'cat_income_other' : 'cat_other'),
            recurring: type === 'transfer' ? false : recurring,
            debt: type === 'expense' && debt ? { status: 'open', certainty: 'possible', ...debt } : null,
        };
        saveTx(record);
        if (!editing) writeLast(type, accountId);
        toast(S.tx.saved);
        onClose();
    };

    const remove = () => {
        if (!window.confirm(S.common.deleteConfirm(S.tx.types[type].toLowerCase()))) return;
        deleteTx(tx.id);
        onClose();
    };

    const accountChips = (options, withNone) => [
        ...options.map((a) => ({ value: a.id, label: a.name, icon: accountIcon(a) })),
        ...(withNone ? [{ value: null, label: S.tx.paidByOther }] : []),
    ];
    const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }));

    return (
        <Sheet
            title={editing ? S.tx.editTitle : S.tx.newExpense}
            onClose={onClose}
            footer={<SheetActions onSave={save} onDelete={editing ? remove : null} />}
        >
            <div className="flex flex-col gap-5">
                <Segmented
                    value={type}
                    onChange={changeType}
                    options={['expense', 'income', 'transfer'].map((value) => ({ value, label: S.tx.types[value] }))}
                />

                <Field label={S.common.amount} error={error}>
                    {(id) => (
                        <AmountInput
                            id={id}
                            inputRef={amountRef}
                            big
                            autoFocus={!editing}
                            value={amountText}
                            onChange={(v) => { setAmountText(v); setError(null); }}
                            currency={txCurrency}
                            currencies={type === 'transfer' ? null : settings.currencies}
                            onCurrencyChange={type === 'transfer' ? null : setCurrency}
                        />
                    )}
                </Field>

                {type !== 'transfer' && (
                    <Field label={S.common.category}>
                        <Chips wrap value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name, icon: categoryIcon(c) }))} />
                    </Field>
                )}

                {type === 'expense' && (
                    <Field label={S.tx.paidWith}>
                        <Chips wrap value={accountId} onChange={setAccountId} options={accountChips(usable, true)} />
                    </Field>
                )}
                {type === 'income' && (
                    <Field label={S.tx.receivedIn}>
                        <Chips wrap value={accountId} onChange={setAccountId} options={accountChips(usable.filter((a) => a.kind !== 'credit'), false)} />
                    </Field>
                )}
                {type === 'transfer' && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label={S.tx.from}><Select value={accountId} onChange={setAccountId} options={accountOptions} /></Field>
                            <Field label={S.tx.to}><Select value={toAccountId} onChange={setToAccountId} options={accountOptions} /></Field>
                        </div>
                        {crossCurrency && (
                            <Field label={S.tx.toAmount} hint={S.tx.toAmountHint}>
                                <AmountInput value={toAmountText} onChange={setToAmountText} currency={toAccount.currency} />
                            </Field>
                        )}
                        <p className="text-[13px] text-dim">{S.tx.transferNote}</p>
                    </>
                )}

                <Field label={S.common.date}>
                    <div className="flex gap-2">
                        <Chips
                            value={date === today ? 'today' : date === addDays(today, -1) ? 'yesterday' : null}
                            onChange={(v) => setDate(v === 'today' ? today : addDays(today, -1))}
                            options={[{ value: 'today', label: S.common.today }, { value: 'yesterday', label: S.common.yesterday }]}
                            wrap
                        />
                        <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="flex-1" />
                    </div>
                </Field>

                <Field label={S.common.note}>
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.common.notePlaceholder} />
                </Field>

                {type !== 'transfer' && (
                    <button type="button" onClick={() => setMore(!more)} className="flex items-center gap-2 self-start font-mono text-[13px] uppercase tracking-[0.08em] text-neon">
                        {more ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        {more ? S.tx.fewerFields : S.tx.moreFields}
                    </button>
                )}

                {more && type !== 'transfer' && (
                    <div className="flex flex-col gap-4 border-t border-line pt-4">
                        {tx?.ruleId && <p className="text-[13px] text-dim">{S.tx.fromRule(doc.rules?.[tx.ruleId]?.name || '')}</p>}
                        <Segmented
                            value={recurring ? 'recurring' : 'oneoff'}
                            onChange={(v) => setRecurring(v === 'recurring')}
                            options={[{ value: 'oneoff', label: S.tx.oneOff }, { value: 'recurring', label: S.tx.recurring }]}
                        />
                        {type === 'expense' && (
                            <Field label={S.tx.debtSection}>
                                <Segmented
                                    value={debt?.direction || 'none'}
                                    onChange={(v) => setDebt(v === 'none' ? null : { ...(debt || { certainty: 'possible', status: 'open' }), direction: v })}
                                    options={[
                                        { value: 'none', label: S.tx.debtNone },
                                        { value: 'iOwe', label: S.tx.debtIOwe },
                                        { value: 'owedToMe', label: S.tx.debtOwedToMe },
                                    ]}
                                />
                            </Field>
                        )}
                        {debt && (
                            <>
                                <Field label={S.tx.certainty}>
                                    <Segmented
                                        value={debt.certainty}
                                        onChange={(v) => setDebt({ ...debt, certainty: v })}
                                        options={[{ value: 'possible', label: S.tx.possible }, { value: 'certain', label: S.tx.certain }]}
                                    />
                                </Field>
                                <Field label={S.tx.who}>
                                    <TextInput value={debt.who || ''} onChange={(e) => setDebt({ ...debt, who: e.target.value })} placeholder={S.common.notePlaceholder} />
                                </Field>
                            </>
                        )}
                    </div>
                )}

                {!more && type !== 'transfer' && recurring && <Toggle checked={recurring} onChange={setRecurring} label={S.tx.recurring} />}
            </div>
        </Sheet>
    );
}
