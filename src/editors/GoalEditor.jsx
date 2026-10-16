import { useState } from 'react';
import { useModel } from '../state/hooks';
import { deleteRecord, saveRecord } from '../state/actions';
import { list } from '../lib/doc';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Field, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

export default function GoalEditor({ goal, onClose }) {
    const { settings, doc, accounts } = useModel();
    const [name, setName] = useState(goal?.name || '');
    const [currency, setCurrency] = useState(goal?.currency || settings.spendingCurrency);
    const [targetText, setTargetText] = useState(goal ? minorToInput(goal.target, goal.currency) : '');
    const [accountIds, setAccountIds] = useState(goal?.accountIds || []);
    const [portionIds, setPortionIds] = useState(goal?.portionIds || []);
    const [error, setError] = useState(null);
    const toggle = (setter, values, id) => setter(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);

    const save = () => {
        const target = parseMoney(targetText, currency);
        if (!name.trim() || !target) { setError(S.common.invalidAmount); return; }
        saveRecord('goals', { ...(goal || {}), name: name.trim(), currency, target, accountIds, portionIds }, 'goal');
        toast(S.tx.saved);
        onClose();
    };
    const remove = () => {
        if (!window.confirm(S.common.deleteConfirm(goal.name))) return;
        deleteRecord('goals', goal.id);
        onClose();
    };

    return (
        <Sheet title={goal ? S.goal.editTitle : S.goal.newTitle} onClose={onClose} footer={<SheetActions onSave={save} onDelete={goal ? remove : null} />}>
            <div className="flex flex-col gap-4">
                {error && <p className="text-[14px] text-hot">{error}</p>}
                <Field label={S.common.name}>
                    {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!goal} />}
                </Field>
                <Field label={S.goal.target}>
                    <AmountInput value={targetText} onChange={setTargetText} currency={currency} currencies={settings.currencies} onCurrencyChange={setCurrency} />
                </Field>
                <Field label={S.goal.sources}>
                    <div className="flex flex-col">
                        {accounts.filter((a) => a.kind !== 'credit').map((a) => (
                            <Toggle key={a.id} checked={accountIds.includes(a.id)} onChange={() => toggle(setAccountIds, accountIds, a.id)} label={`${a.name} · ${a.currency}`} />
                        ))}
                    </div>
                </Field>
                <Field label={S.goal.goldPortions}>
                    <div className="flex flex-col">
                        {list(doc, 'portions').map((p) => (
                            <Toggle key={p.id} checked={portionIds.includes(p.id)} onChange={() => toggle(setPortionIds, portionIds, p.id)} label={p.name} />
                        ))}
                    </div>
                </Field>
            </div>
        </Sheet>
    );
}
