import { useState } from 'react';
import { useModel } from '../state/hooks';
import { accountInUse, deleteAccount, saveAccount } from '../state/actions';
import { latestAnchor } from '../lib/ledger';
import { formatDate } from '../lib/dates';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Field, Select, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

const KINDS = ['bank', 'ewallet', 'cash', 'investment'];

export default function AccountEditor({ account, kind = 'bank', onClose }) {
    const model = useModel();
    const { settings, doc } = model;
    const current = account ? model.accountsById[account.id] : null;
    const anchor = account ? latestAnchor(doc, account.id) : null;

    const [name, setName] = useState(account?.name || '');
    const [accountKind, setKind] = useState(account?.kind || kind);
    const [currency, setCurrency] = useState(account?.currency || settings.displayCurrency);
    const [balanceText, setBalanceText] = useState(current ? minorToInput(current.balance, current.currency) : '');
    const [available, setAvailable] = useState(account ? account.available !== false : kind !== 'investment');
    const [note, setNote] = useState(account?.note || '');
    const [error, setError] = useState(null);

    const save = () => {
        if (!name.trim()) { setError(S.common.required); return; }
        const balance = balanceText.trim() === '' ? 0 : parseMoney(balanceText, currency);
        if (balance === null) { setError(S.common.invalidAmount); return; }
        const sameCurrency = !account || account.currency === currency;
        saveAccount(
            { ...(account || {}), name: name.trim(), kind: accountKind, currency, available, note: note.trim() },
            balance,
            sameCurrency ? current?.balance : null,
        );
        toast(S.tx.saved);
        onClose();
    };

    const remove = () => {
        if (accountInUse(doc, account.id)) { window.alert(S.account.deleteBlocked); return; }
        if (!window.confirm(S.common.deleteConfirm(account.name))) return;
        deleteAccount(account.id);
        onClose();
    };

    return (
        <Sheet
            title={account ? S.account.editTitle : S.account.newTitle}
            onClose={onClose}
            footer={<SheetActions onSave={save} onDelete={account ? remove : null} />}
        >
            <div className="flex flex-col gap-4">
                <Field label={S.common.name} error={!name.trim() ? error : null}>
                    {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!account} />}
                </Field>
                {accountKind !== 'credit' && (
                    <Field label={S.account.kind}>
                        <Select
                            value={accountKind}
                            onChange={(v) => { setKind(v); if (v === 'investment') setAvailable(false); }}
                            options={KINDS.map((value) => ({ value, label: S.kinds[value] }))}
                        />
                    </Field>
                )}
                <Field
                    label={S.account.balance}
                    hint={anchor ? S.account.balanceAsOf(formatDate(anchor.date, { year: true })) : S.account.balanceHint}
                    error={name.trim() ? error : null}
                >
                    <AmountInput
                        value={balanceText}
                        onChange={(v) => { setBalanceText(v); setError(null); }}
                        currency={currency}
                        currencies={settings.currencies}
                        onCurrencyChange={setCurrency}
                    />
                </Field>
                <Toggle checked={available} onChange={setAvailable} label={S.account.available} hint={S.account.availableHint} />
                <Field label={S.common.note}>
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.account.notePlaceholder} />
                </Field>
            </div>
        </Sheet>
    );
}
