import { useState } from 'react';
import { useModel } from '../state/hooks';
import { saveCardTerms } from '../state/actions';
import { PRESETS, cardPreset, cardTerms, effectiveAnnualRate, effectiveMonthlyRate, interestIfMinimum } from '../lib/cards';
import { formatMoney, formatPercent, minorToInput, parseDecimal, parseMoney } from '../lib/money';
import { AmountInput, Field, Segmented, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

const pctOk = (text) => String(text).trim() === '' || parseDecimal(text, 4) !== null;
const pctValue = (text) => (String(text).trim() === '' ? null : parseDecimal(text, 4).toString());
const dayValue = (text) => {
    const n = Number(text);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

/** One card's interest rules: a country preset, then the bank's own numbers. */
export default function CardTermsEditor({ card: given, onClose }) {
    const { cards } = useModel();
    const card = cards.find((c) => c.id === given.id) || given;
    const start = cardTerms(card);
    const [preset, setPreset] = useState(cardPreset(card));
    const [monthlyRate, setMonthlyRate] = useState(card.monthlyRate || '');
    const [rateConfirmed, setRateConfirmed] = useState(card.rateConfirmed !== false);
    const [taxRate, setTaxRate] = useState(start.taxPct);
    const [minPct, setMinPct] = useState(start.minPct);
    const [floorText, setFloorText] = useState(start.minFloor ? minorToInput(start.minFloor, card.currency) : '');
    const [interestBase, setInterestBase] = useState(start.interestBase);
    const [lateExtra, setLateExtra] = useState(start.lateExtraPct);
    const [statementDay, setStatementDay] = useState(card.statementDay ? String(card.statementDay) : '');
    const [dueDay, setDueDay] = useState(card.dueDay ? String(card.dueDay) : '');
    const [stmtBalanceText, setStmtBalanceText] = useState(card.lastStatement?.balance ? minorToInput(card.lastStatement.balance, card.currency) : '');
    const [stmtInterestText, setStmtInterestText] = useState(card.lastStatement?.interest ? minorToInput(card.lastStatement.interest, card.currency) : '');
    const [error, setError] = useState(null);

    const choosePreset = (key) => {
        setPreset(key);
        const p = PRESETS[key];
        setTaxRate(p.taxPct);
        setMinPct(p.minPct);
        setInterestBase(p.interestBase);
        setLateExtra(p.lateExtraPct);
    };

    const floor = floorText.trim() === '' ? 0 : parseMoney(floorText, card.currency);
    const valid = [monthlyRate, taxRate, minPct, lateExtra].every(pctOk) && floor !== null;
    const preview = valid && pctValue(monthlyRate)
        ? { monthlyRatePct: pctValue(monthlyRate), taxPct: pctValue(taxRate) ?? '0', minPct: pctValue(minPct) ?? '0', minFloor: floor, interestBase, lateExtraPct: pctValue(lateExtra) ?? '0' }
        : null;
    const monthly = preview ? effectiveMonthlyRate(preview.monthlyRatePct, preview.taxPct) : null;

    const save = () => {
        const parse = (text) => (text.trim() === '' ? 0 : parseMoney(text, card.currency));
        const stmtBalance = parse(stmtBalanceText);
        const stmtInterest = parse(stmtInterestText);
        if (!valid || stmtBalance === null || stmtInterest === null) { setError(S.common.invalidAmount); return; }
        saveCardTerms(card.id, {
            rulePreset: preset,
            monthlyRate: pctValue(monthlyRate),
            rateConfirmed,
            taxRate: pctValue(taxRate) ?? '0',
            minPaymentPct: pctValue(minPct) ?? '0',
            minPaymentFloor: floor || 0,
            interestBase,
            lateExtraPct: pctValue(lateExtra) ?? '0',
            statementDay: dayValue(statementDay),
            dueDay: dayValue(dueDay),
            lastStatement: stmtBalance || stmtInterest ? { balance: stmtBalance, interest: stmtInterest } : null,
        });
        toast(S.tx.saved);
        onClose();
    };

    const pctField = (label, value, set, hint, placeholder) => (
        <Field label={label} hint={hint}>
            {(id) => <TextInput id={id} inputMode="decimal" value={value} onChange={(e) => { set(e.target.value); setError(null); }} placeholder={placeholder} />}
        </Field>
    );

    return (
        <Sheet title={S.card.termsTitle(card.name)} onClose={onClose} footer={<SheetActions onSave={save} />} wide>
            <div className="flex flex-col gap-4">
                {error && <p className="text-[14px] text-hot">{error}</p>}
                <Field label={S.card.preset} hint={S.card.presetHint[preset]}>
                    <Segmented value={preset} onChange={choosePreset} options={Object.keys(PRESETS).map((key) => ({ value: key, label: S.card.presets[key] }))} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    {pctField(S.card.monthlyRate, monthlyRate, setMonthlyRate, null, preset === 'turkey' ? '3.75' : '3.1')}
                    {pctField(S.card.taxRate, taxRate, setTaxRate, S.card.taxHint)}
                </div>
                <Toggle checked={!rateConfirmed} onChange={(v) => setRateConfirmed(!v)} label={S.card.rateAssumed} />
                <Field label={S.card.interestBase}>
                    <Segmented value={interestBase} onChange={setInterestBase} options={['remainder', 'statement'].map((value) => ({ value, label: S.card.bases[value] }))} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {pctField(S.card.minPayment, minPct, setMinPct)}
                    <Field label={S.card.minFloor} hint={S.card.minFloorHint}>
                        <AmountInput value={floorText} onChange={(v) => { setFloorText(v); setError(null); }} currency={card.currency} />
                    </Field>
                    {pctField(S.card.lateExtra, lateExtra, setLateExtra)}
                </div>
                {monthly && (
                    <p className="border border-line bg-field px-3 py-2.5 text-[14px] leading-snug text-body">
                        {S.card.effective(formatPercent(Number(monthly.toString()), 2), formatPercent(Number(effectiveAnnualRate(monthly).toString()), 0))}
                        {card.debt > 0 && <span className="text-hot"> {S.card.interestNext}: {formatMoney(interestIfMinimum(card.debt, preview), card.currency)}.</span>}
                    </p>
                )}
                <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
                    <Field label={S.card.statementDay}>
                        {(id) => <TextInput id={id} inputMode="numeric" value={statementDay} onChange={(e) => setStatementDay(e.target.value.replace(/\D/g, ''))} placeholder="1–31" />}
                    </Field>
                    <Field label={S.card.dueDay}>
                        {(id) => <TextInput id={id} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))} placeholder="1–31" />}
                    </Field>
                </div>
                <p className="border-t border-line pt-4 font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{S.card.lastStatement}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={S.card.statementBalance}><AmountInput value={stmtBalanceText} onChange={setStmtBalanceText} currency={card.currency} /></Field>
                    <Field label={S.card.statementInterest}><AmountInput value={stmtInterestText} onChange={setStmtInterestText} currency={card.currency} /></Field>
                </div>
            </div>
        </Sheet>
    );
}
