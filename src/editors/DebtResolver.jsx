import { useState } from 'react';
import { useModel } from '../state/hooks';
import { deleteTx, resolveDebt } from '../state/actions';
import { formatDate } from '../lib/dates';
import { debtAmount } from '../lib/model';
import { formatMoney, minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Button, Chips, DateInput, Field, Sheet, toast } from '../ui/kit';
import { accountIcon } from '../ui/icons';
import { openSheet } from '../ui/sheets';
import S from '../i18n/strings';

export default function DebtResolver({ tx, onClose }) {
    const { accounts, today, doc } = useModel();
    const iOwe = tx.debt.direction === 'iOwe';
    const [accountId, setAccountId] = useState(accounts.find((a) => a.currency === tx.currency && a.kind !== 'credit')?.id || accounts[0]?.id || null);
    const [amountText, setAmountText] = useState(minorToInput(debtAmount(tx), tx.currency));
    const [date, setDate] = useState(today);
    const [error, setError] = useState(null);
    const category = doc.categories?.[tx.categoryId];

    const settle = () => {
        const amount = parseMoney(amountText, tx.currency);
        if (!amount) { setError(S.common.invalidAmount); return; }
        resolveDebt(tx, iOwe ? 'paid' : 'received', { accountId, date, amount });
        toast(S.tx.saved);
        onClose();
    };
    const act = (action) => {
        resolveDebt(tx, action);
        toast(S.tx.saved);
        onClose();
    };

    return (
        <Sheet title={S.tx.resolveTitle} onClose={onClose}>
            <div className="flex flex-col gap-5">
                <div className="border border-line bg-field p-3">
                    <p className="text-[16px] text-white">{tx.note || category?.name}{tx.debt.who ? ` · ${tx.debt.who}` : ''}</p>
                    <p className="mt-1 font-mono text-[14px] text-muted">
                        {formatMoney(debtAmount(tx), tx.currency)} · {formatDate(tx.date, { year: true })} · {tx.debt.certainty === 'possible' ? S.tx.possible : S.tx.certain}
                    </p>
                    <button type="button" className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em] text-neon" onClick={() => openSheet('tx', { tx })}>{S.common.edit}</button>
                </div>

                <div className="flex flex-col gap-4 border border-line p-3">
                    <p className="font-display text-[17px] text-white">{iOwe ? S.tx.resolvePaid : S.tx.resolveReceived}</p>
                    <Field label={S.common.amount} error={error}>
                        <AmountInput value={amountText} onChange={(v) => { setAmountText(v); setError(null); }} currency={tx.currency} />
                    </Field>
                    <Field label={iOwe ? S.tx.resolveFrom : S.tx.resolveInto}>
                        <Chips wrap value={accountId} onChange={setAccountId} options={accounts.filter((a) => !['investment', 'other'].includes(a.kind)).map((a) => ({ value: a.id, label: a.name, icon: accountIcon(a) }))} />
                    </Field>
                    <Field label={S.common.date}><DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
                    <Button variant="primary" onClick={settle}>{S.common.confirm}</Button>
                </div>

                <div className="flex flex-col gap-2">
                    {tx.debt.certainty === 'possible' && <Button onClick={() => act('certain')}>{S.tx.resolveMakeCertain}</Button>}
                    <Button variant="danger" onClick={() => act('cancel')}>{S.tx.resolveCancel}</Button>
                    <Button variant="ghost" onClick={() => { if (window.confirm(S.common.deleteConfirm(tx.note || category?.name || ''))) { deleteTx(tx.id); onClose(); } }}>{S.common.delete}</Button>
                </div>
            </div>
        </Sheet>
    );
}
