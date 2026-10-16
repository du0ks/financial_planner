import { useState } from 'react';
import { useModel } from '../state/hooks';
import { accountInUse, deleteAccount, saveCard } from '../state/actions';
import { DEFAULT_MIN_PAYMENT_PCT, DEFAULT_TAX_PCT } from '../lib/cards';
import { minorToInput, parseDecimal, parseMoney } from '../lib/money';
import { AmountInput, Field, Select, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

const pctOk = (text) => text.trim() === '' || parseDecimal(text, 4) !== null;
const pctValue = (text) => (text.trim() === '' ? null : parseDecimal(text, 4).toString());
const dayValue = (text) => {
    const n = Number(text);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

export default function CardEditor({ card, onClose }) {
    const model = useModel();
    const { settings, doc, accounts, cards } = model;
    const current = card ? cards.find((c) => c.id === card.id) : null;

    const [name, setName] = useState(card?.name || '');
    const [currency, setCurrency] = useState(card?.currency || settings.displayCurrency);
    const [limitText, setLimitText] = useState(card?.limit ? minorToInput(card.limit, card.currency) : '');
    const [debtText, setDebtText] = useState(current ? minorToInput(current.debt, current.currency) : '');
    const linkedElsewhere = new Set(cards.filter((c) => c.id !== card?.id).map((c) => c.linkedAccountId).filter(Boolean));
    const depositChoices = accounts.filter((a) => a.kind === 'bank' && !linkedElsewhere.has(a.id));
    const [depositMode, setDepositMode] = useState(card?.linkedAccountId ? card.linkedAccountId : card ? 'none' : 'new');
    const depositAccount = accounts.find((a) => a.id === depositMode);
    const [depositText, setDepositText] = useState(depositAccount ? minorToInput(depositAccount.balance, depositAccount.currency) : '');
    const [monthlyRate, setMonthlyRate] = useState(card?.monthlyRate || '');
    const [rateConfirmed, setRateConfirmed] = useState(card ? card.rateConfirmed !== false : true);
    const [taxRate, setTaxRate] = useState(card?.taxRate ?? DEFAULT_TAX_PCT);
    const [minPct, setMinPct] = useState(card?.minPaymentPct ?? DEFAULT_MIN_PAYMENT_PCT);
    const [statementDay, setStatementDay] = useState(card?.statementDay ? String(card.statementDay) : '');
    const [dueDay, setDueDay] = useState(card?.dueDay ? String(card.dueDay) : '');
    const [stmtBalanceText, setStmtBalanceText] = useState(card?.lastStatement?.balance ? minorToInput(card.lastStatement.balance, card.currency) : '');
    const [stmtInterestText, setStmtInterestText] = useState(card?.lastStatement?.interest ? minorToInput(card.lastStatement.interest, card.currency) : '');
    const [error, setError] = useState(null);

    const changeDeposit = (value) => {
        setDepositMode(value);
        const account = accounts.find((a) => a.id === value);
        setDepositText(account ? minorToInput(account.balance, account.currency) : '');
    };

    const save = () => {
        if (!name.trim()) { setError(S.common.required); return; }
        const parse = (text) => (text.trim() === '' ? 0 : parseMoney(text, currency));
        const limit = parse(limitText);
        const debt = parse(debtText);
        const stmtBalance = parse(stmtBalanceText);
        const stmtInterest = parse(stmtInterestText);
        const depositCurrency = depositAccount?.currency || currency;
        const depositBalance = depositText.trim() === '' ? 0 : parseMoney(depositText, depositCurrency);
        if ([limit, debt, stmtBalance, stmtInterest, depositBalance].some((v) => v === null)) { setError(S.common.invalidAmount); return; }
        if (![monthlyRate, taxRate, minPct].every(pctOk)) { setError(S.common.invalidAmount); return; }

        saveCard(
            {
                ...(card || {}),
                name: name.trim(),
                currency,
                limit,
                available: true,
                monthlyRate: pctValue(monthlyRate),
                rateConfirmed,
                taxRate: pctValue(taxRate) ?? '0',
                minPaymentPct: pctValue(minPct) ?? DEFAULT_MIN_PAYMENT_PCT,
                statementDay: dayValue(statementDay),
                dueDay: dayValue(dueDay),
                lastStatement: stmtBalance || stmtInterest ? { balance: stmtBalance, interest: stmtInterest } : null,
            },
            {
                debt,
                currentDebt: current && current.currency === currency ? current.debt : null,
                deposit: depositMode === 'new' ? { mode: 'new' } : depositMode === 'none' ? { mode: 'none' } : { mode: 'existing', id: depositMode },
                depositBalance,
                currentDepositBalance: depositAccount?.balance,
            },
        );
        toast(S.tx.saved);
        onClose();
    };

    const remove = () => {
        if (accountInUse(doc, card.id)) { window.alert(S.account.deleteBlocked); return; }
        if (!window.confirm(S.common.deleteConfirm(card.name))) return;
        deleteAccount(card.id);
        onClose();
    };

    const money = (label, value, set, hint, cur = currency) => (
        <Field label={label} hint={hint}>
            <AmountInput value={value} onChange={(v) => { set(v); setError(null); }} currency={cur} />
        </Field>
    );

    return (
        <Sheet
            title={card ? S.card.editTitle : S.card.newTitle}
            onClose={onClose}
            footer={<SheetActions onSave={save} onDelete={card ? remove : null} />}
            wide
        >
            <div className="flex flex-col gap-4">
                {error && <p className="text-[14px] text-hot">{error}</p>}
                <div className="grid grid-cols-[1fr_110px] gap-3">
                    <Field label={S.card.name}>
                        {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!card} />}
                    </Field>
                    <Field label={S.common.currency}>
                        <Select value={currency} onChange={setCurrency} options={settings.currencies.map((c) => ({ value: c, label: c }))} />
                    </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {money(S.card.limit, limitText, setLimitText)}
                    {money(S.card.debt, debtText, setDebtText, S.card.debtHint)}
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
                    <Field label={S.card.deposit}>
                        <Select
                            value={depositMode}
                            onChange={changeDeposit}
                            options={[
                                ...depositChoices.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` })),
                                { value: 'new', label: S.card.depositNew },
                                { value: 'none', label: S.card.depositNone },
                            ]}
                        />
                    </Field>
                    {depositMode !== 'none' && money(S.card.depositBalance, depositText, setDepositText, null, depositAccount?.currency || currency)}
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
                    <Field label={S.card.monthlyRate}>
                        <TextInput inputMode="decimal" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} placeholder="3.75" />
                    </Field>
                    <Field label={S.card.taxRate} hint={S.card.taxHint}>
                        <TextInput inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                    </Field>
                </div>
                <Toggle checked={!rateConfirmed} onChange={(v) => setRateConfirmed(!v)} label={S.card.rateAssumed} />
                <div className="grid grid-cols-3 gap-3">
                    <Field label={S.card.minPayment}>
                        <TextInput inputMode="decimal" value={minPct} onChange={(e) => setMinPct(e.target.value)} />
                    </Field>
                    <Field label={S.card.statementDay}>
                        <TextInput inputMode="numeric" value={statementDay} onChange={(e) => setStatementDay(e.target.value.replace(/\D/g, ''))} placeholder="1–31" />
                    </Field>
                    <Field label={S.card.dueDay}>
                        <TextInput inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))} placeholder="1–31" />
                    </Field>
                </div>

                <p className="border-t border-line pt-4 font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{S.card.lastStatement}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {money(S.card.statementBalance, stmtBalanceText, setStmtBalanceText)}
                    {money(S.card.statementInterest, stmtInterestText, setStmtInterestText)}
                </div>
            </div>
        </Sheet>
    );
}
