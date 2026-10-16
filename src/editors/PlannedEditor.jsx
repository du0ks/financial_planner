import { useState } from 'react';
import { useModel } from '../state/hooks';
import { deleteRecord, saveRecord } from '../state/actions';
import { list } from '../lib/doc';
import { monthOf } from '../lib/dates';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Field, Segmented, Select, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

export default function PlannedEditor({ item, onClose }) {
    const { settings, doc, today } = useModel();
    const [name, setName] = useState(item?.name || '');
    const [currency, setCurrency] = useState(item?.currency || settings.spendingCurrency);
    const [minText, setMinText] = useState(item?.min ? minorToInput(item.min, item.currency) : '');
    const [maxText, setMaxText] = useState(item?.max ? minorToInput(item.max, item.currency) : '');
    const [month, setMonth] = useState(item?.month || monthOf(today));
    const [priority, setPriority] = useState(String(item?.priority ?? (list(doc, 'planned').length + 1)));
    const [big, setBig] = useState(Boolean(item?.big));
    const [categoryId, setCategoryId] = useState(item?.categoryId || 'cat_other');
    const [status, setStatus] = useState(item?.status || 'planned');
    const [note, setNote] = useState(item?.note || '');
    const [error, setError] = useState(null);

    const categories = list(doc, 'categories').filter((c) => !c.income && !c.system).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const save = () => {
        if (!name.trim()) { setError(S.common.required); return; }
        const min = minText.trim() ? parseMoney(minText, currency) : null;
        const max = maxText.trim() ? parseMoney(maxText, currency) : null;
        if ((minText.trim() && min === null) || (maxText.trim() && max === null)) { setError(S.common.invalidAmount); return; }
        saveRecord('planned', {
            ...(item || {}), name: name.trim(), currency, min, max: max ?? min, month, big, categoryId, status,
            priority: Number(priority) || 1, note: note.trim(),
        }, 'planned');
        toast(S.tx.saved);
        onClose();
    };

    const remove = () => {
        if (!window.confirm(S.common.deleteConfirm(item.name))) return;
        deleteRecord('planned', item.id);
        onClose();
    };

    return (
        <Sheet title={item ? S.planned.editTitle : S.planned.newTitle} onClose={onClose} footer={<SheetActions onSave={save} onDelete={item ? remove : null} />}>
            <div className="flex flex-col gap-4">
                {error && <p className="text-[14px] text-hot">{error}</p>}
                <Field label={S.common.name}>
                    {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!item} />}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={S.planned.min}>
                        <AmountInput value={minText} onChange={setMinText} currency={currency} currencies={settings.currencies} onCurrencyChange={setCurrency} />
                    </Field>
                    <Field label={S.planned.max}>
                        <AmountInput value={maxText} onChange={setMaxText} currency={currency} />
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={S.planned.month}>
                        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-12 w-full border border-line-strong bg-field px-3 font-mono text-white outline-none focus:border-neon" />
                    </Field>
                    <Field label={S.planned.priority}>
                        <TextInput inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                </div>
                <Field label={S.common.category}>
                    <Select value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
                </Field>
                <Toggle checked={big} onChange={setBig} label={S.planned.big} hint={S.planned.bigHint} />
                {item && (
                    <Segmented
                        value={status}
                        onChange={setStatus}
                        options={[{ value: 'planned', label: S.plan.restore }, { value: 'bought', label: S.plan.bought }, { value: 'dropped', label: S.plan.dropped }]}
                    />
                )}
                <Field label={S.common.note}>
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.common.notePlaceholder} />
                </Field>
            </div>
        </Sheet>
    );
}
