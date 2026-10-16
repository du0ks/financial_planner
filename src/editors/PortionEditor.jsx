import { useState } from 'react';
import { useModel } from '../state/hooks';
import { deleteRecord, saveRecord } from '../state/actions';
import { list } from '../lib/doc';
import { goldHoldings } from '../lib/gold';
import { Field, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

export default function PortionEditor({ portion, onClose }) {
    const { doc } = useModel();
    const [name, setName] = useState(portion?.name || '');
    const [available, setAvailable] = useState(portion ? Boolean(portion.available) : true);
    const holds = portion ? goldHoldings(doc)[portion.id] || 0 : 0;
    const used = portion && list(doc, 'goldEvents').some((e) => e.portionId === portion.id || e.toPortionId === portion.id);

    const save = () => {
        if (!name.trim()) return;
        saveRecord('portions', { ...(portion || {}), name: name.trim(), available, order: portion?.order ?? list(doc, 'portions').length }, 'portion');
        toast(S.tx.saved);
        onClose();
    };
    const remove = () => {
        if (!window.confirm(S.common.deleteConfirm(portion.name))) return;
        deleteRecord('portions', portion.id);
        onClose();
    };

    return (
        <Sheet title={portion ? portion.name : S.gold.addPortion} onClose={onClose} footer={<SheetActions onSave={save} onDelete={portion && !used && holds === 0 ? remove : null} />}>
            <div className="flex flex-col gap-4">
                <Field label={S.gold.portionName}>
                    {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!portion} />}
                </Field>
                <Toggle checked={available} onChange={setAvailable} label={S.gold.portionAvailable} hint={S.gold.portionsExplain} />
            </div>
        </Sheet>
    );
}
