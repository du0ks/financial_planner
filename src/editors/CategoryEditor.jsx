import { useState } from 'react';
import { useModel } from '../state/hooks';
import { categoryInUse, deleteRecord, mergeCategory, saveRecord } from '../state/actions';
import { list } from '../lib/doc';
import { Button, Chips, Field, Select, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import { CATEGORY_ICONS } from '../ui/icons';
import S from '../i18n/strings';

export default function CategoryEditor({ category, onClose }) {
    const { doc } = useModel();
    const [name, setName] = useState(category?.name || '');
    const [icon, setIcon] = useState(category?.icon || 'dots');
    const [income, setIncome] = useState(Boolean(category?.income));
    const [mergeTarget, setMergeTarget] = useState('');
    const others = list(doc, 'categories').filter((c) => c.id !== category?.id && Boolean(c.income) === income);

    const save = () => {
        if (!name.trim()) return;
        saveRecord('categories', { ...(category || {}), name: name.trim(), icon, income, order: category?.order ?? list(doc, 'categories').length }, 'cat');
        toast(S.tx.saved);
        onClose();
    };
    const remove = () => {
        if (categoryInUse(doc, category.id)) { window.alert(S.settings.categoriesExplain); return; }
        if (!window.confirm(S.common.deleteConfirm(category.name))) return;
        deleteRecord('categories', category.id);
        onClose();
    };
    const merge = () => {
        const target = others.find((c) => c.id === mergeTarget);
        if (!target || !window.confirm(S.settings.merged(category.name, target.name) + '?')) return;
        mergeCategory(category.id, target.id);
        toast(S.settings.merged(category.name, target.name));
        onClose();
    };

    return (
        <Sheet title={category ? category.name : S.settings.addCategory} onClose={onClose} footer={<SheetActions onSave={save} onDelete={category && !category.system ? remove : null} />}>
            <div className="flex flex-col gap-4">
                <Field label={S.common.name}>
                    {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!category} />}
                </Field>
                <Chips wrap value={icon} onChange={setIcon} options={Object.entries(CATEGORY_ICONS).map(([value, Icon]) => ({ value, label: '', icon: Icon }))} />
                {!category && <Toggle checked={income} onChange={setIncome} label={S.tx.types.income} />}
                {category && !category.system && others.length > 0 && (
                    <div className="flex items-end gap-3 border-t border-line pt-4">
                        <Field label={S.settings.mergeInto} className="flex-1">
                            <Select value={mergeTarget} onChange={setMergeTarget} options={[{ value: '', label: '—' }, ...others.map((c) => ({ value: c.id, label: c.name }))]} />
                        </Field>
                        <Button onClick={merge} disabled={!mergeTarget}>{S.common.confirm}</Button>
                    </div>
                )}
            </div>
        </Sheet>
    );
}
