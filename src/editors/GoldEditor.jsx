import { useState } from 'react';
import { useModel } from '../state/hooks';
import { deleteRecord, saveGoldEvent } from '../state/actions';
import { list } from '../lib/doc';
import { goldHoldings, parseGrams } from '../lib/gold';
import { goldValueMinor } from '../lib/fx';
import { formatMoney, minorToInput, parseMoney } from '../lib/money';
import { AmountInput, DateInput, Field, Segmented, Select, Sheet, SheetActions, TextInput, toast } from '../ui/kit';
import S from '../i18n/strings';

const TYPES = ['buy', 'sell', 'move', 'adjust'];

export default function GoldEditor({ event, type: initialType = 'buy', touchable, onClose }) {
    const { doc, settings, today, display, fx } = useModel();
    const portions = list(doc, 'portions').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const [type, setType] = useState(event?.type || initialType);
    const [gramsText, setGramsText] = useState(event ? String(Math.abs(event.mg) / 1000 * (event.mg < 0 ? -1 : 1)) : '');
    const [portionId, setPortionId] = useState(event?.portionId || (touchable !== undefined && portions.find((p) => Boolean(p.available) === touchable)?.id) || portions[0]?.id || '');
    const [toPortionId, setToPortionId] = useState(event?.toPortionId || portions[1]?.id || portions[0]?.id || '');
    const [currency, setCurrency] = useState(event?.currency || settings.displayCurrency);
    const [priceText, setPriceText] = useState(event?.price ? minorToInput(event.price, event.currency) : '');
    const [date, setDate] = useState(event?.date || today);
    const [note, setNote] = useState(event?.note || '');
    const [error, setError] = useState(null);

    const negativeAllowed = type === 'adjust';
    const mgRaw = parseGrams(gramsText.replace(/^-/, ''));
    const mg = mgRaw === null ? null : (negativeAllowed && gramsText.trim().startsWith('-') ? -mgRaw : mgRaw);
    const worth = mg ? goldValueMinor(Math.abs(mg), display, fx) : null;

    const save = () => {
        if (!mg || (!negativeAllowed && mg <= 0)) { setError(S.common.invalidAmount); return; }
        const price = priceText.trim() ? parseMoney(priceText, currency) : null;
        if (priceText.trim() && price === null) { setError(S.common.invalidAmount); return; }
        if (type === 'sell' || type === 'move') {
            const holdings = goldHoldings(doc);
            const already = event && event.portionId === portionId && (event.type === 'sell' || event.type === 'move') ? event.mg : 0;
            if ((holdings[portionId] || 0) + already < mg) { setError(S.gold.tooMuch); return; }
        }
        saveGoldEvent({
            ...(event || {}), type, mg, portionId,
            toPortionId: type === 'move' ? toPortionId : null,
            price: type === 'buy' || type === 'sell' ? price : null,
            currency: type === 'buy' || type === 'sell' ? currency : null,
            date, note: note.trim(),
        });
        toast(S.tx.saved);
        onClose();
    };

    const remove = () => {
        if (!window.confirm(S.common.deleteConfirm(S.gold.events[event.type].toLowerCase()))) return;
        deleteRecord('goldEvents', event.id);
        onClose();
    };

    const portionOptions = portions.map((p) => ({ value: p.id, label: p.name }));
    return (
        <Sheet title={S.gold.events[type]} onClose={onClose} footer={<SheetActions onSave={save} onDelete={event ? remove : null} />}>
            <div className="flex flex-col gap-4">
                {!event && (
                    <Segmented value={type} onChange={setType} options={TYPES.map((value) => ({ value, label: S.gold[value] }))} />
                )}
                <Field label={S.gold.gramsLabel} error={error} hint={type === 'adjust' ? S.gold.adjustHint : worth !== null ? S.common.approx(formatMoney(worth, display, { decimals: 'never' })) : null}>
                    <AmountInput big autoFocus={!event} value={gramsText} onChange={(v) => { setGramsText(v); setError(null); }} currency="g" />
                </Field>
                <div className={type === 'move' ? 'grid grid-cols-2 gap-3' : ''}>
                    <Field label={S.gold.portion}><Select value={portionId} onChange={setPortionId} options={portionOptions} /></Field>
                    {type === 'move' && <Field label={S.gold.toPortion}><Select value={toPortionId} onChange={setToPortionId} options={portionOptions} /></Field>}
                </div>
                {(type === 'buy' || type === 'sell') && (
                    <Field label={type === 'buy' ? S.gold.pricePaid : S.gold.priceReceived}>
                        <AmountInput value={priceText} onChange={setPriceText} currency={currency} currencies={settings.currencies} onCurrencyChange={setCurrency} />
                    </Field>
                )}
                <Field label={S.common.date}><DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
                <Field label={S.common.note}><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.common.notePlaceholder} /></Field>
            </div>
        </Sheet>
    );
}
