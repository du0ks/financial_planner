import { useState } from 'react';
import { useModel } from '../state/hooks';
import { confirmOccurrence, deleteTx, skipOccurrence } from '../state/actions';
import { formatDate } from '../lib/dates';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Button, Chips, DateInput, Field, Sheet, TextInput, toast } from '../ui/kit';
import { accountIcon } from '../ui/icons';
import Equivalents from '../ui/Equivalents';
import S from '../i18n/strings';

/** Confirms one month's recurring income or bill: amount and account can differ each time. */
export default function ConfirmOccurrence({ occurrence, onClose }) {
    const { accounts, today } = useModel();
    const { rule, tx } = occurrence;
    const [amountText, setAmountText] = useState(minorToInput(tx?.skipped ? rule.amount : tx?.amount ?? rule.amount, rule.currency));
    const [accountId, setAccountId] = useState(tx?.accountId ?? rule.accountId ?? null);
    const [date, setDate] = useState(tx?.date || (occurrence.date <= today ? occurrence.date : today));
    const [note, setNote] = useState(tx?.note || '');
    const [error, setError] = useState(null);

    const options = accounts.filter((a) => !['investment', 'other'].includes(a.kind) && (rule.type === 'expense' || a.kind !== 'credit'));

    const confirm = () => {
        const amount = parseMoney(amountText, rule.currency);
        if (!amount || amount <= 0) { setError(S.common.invalidAmount); return; }
        confirmOccurrence(occurrence, { amount, accountId, date, note });
        toast(S.tx.saved);
        onClose();
    };

    return (
        <Sheet
            title={`${S.rule.confirmTitle}: ${rule.name}`}
            onClose={onClose}
            footer={(
                <div className="flex gap-3">
                    {occurrence.done
                        ? <Button variant="danger" onClick={() => { deleteTx(tx.id); onClose(); }}>{S.common.delete}</Button>
                        : <Button variant="outline" onClick={() => { skipOccurrence(occurrence); onClose(); }}>{S.common.skip}</Button>}
                    <Button variant="primary" className="flex-1" onClick={confirm}>{S.common.confirm}</Button>
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                <p className="text-[14px] text-muted">{formatDate(occurrence.date, { year: true })} · {S.rule.confirmHint}</p>
                <Field label={S.common.amount} error={error}>
                    <AmountInput big autoFocus value={amountText} onChange={(v) => { setAmountText(v); setError(null); }} currency={rule.currency} />
                </Field>
                <Equivalents minor={parseMoney(amountText, rule.currency) || 0} currency={rule.currency} date={date} />
                <Field label={rule.type === 'income' ? S.tx.receivedIn : S.tx.paidWith}>
                    <Chips wrap value={accountId} onChange={setAccountId} options={options.map((a) => ({ value: a.id, label: a.name, icon: accountIcon(a) }))} />
                </Field>
                <Field label={S.common.date}>
                    <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                </Field>
                <Field label={S.common.note}>
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.common.notePlaceholder} />
                </Field>
            </div>
        </Sheet>
    );
}
