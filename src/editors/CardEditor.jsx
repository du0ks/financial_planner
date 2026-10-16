import { useState } from 'react';
import { useModel } from '../state/hooks';
import { accountInUse, deleteAccount, saveCard } from '../state/actions';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, CurrencySelect, Field, Select, Sheet, SheetActions, TextInput, toast } from '../ui/kit';
import S from '../i18n/strings';

/** A card's name, currency, limit, debt and bank account. Interest rules live on the Debts tab. */
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
        const depositCurrency = depositAccount?.currency || currency;
        const depositBalance = depositText.trim() === '' ? 0 : parseMoney(depositText, depositCurrency);
        if ([limit, debt, depositBalance].some((v) => v === null)) { setError(S.common.invalidAmount); return; }

        saveCard(
            {
                ...(card || {}),
                name: name.trim(),
                currency,
                limit,
                available: true,
                // A new card starts with its country's rules; they are changed on the Debts tab.
                ...(card ? {} : { rulePreset: currency === 'TRY' ? 'turkey' : 'generic' }),
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
                        <CurrencySelect value={currency} onChange={setCurrency} mine={settings.currencies} />
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

            </div>
        </Sheet>
    );
}
