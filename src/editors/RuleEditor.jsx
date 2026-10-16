import { useState } from 'react';
import { useModel } from '../state/hooks';
import { deleteRecord, saveRecord } from '../state/actions';
import { list } from '../lib/doc';
import { monthOf } from '../lib/dates';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Field, Select, Sheet, SheetActions, TextInput, Toggle, toast } from '../ui/kit';
import S from '../i18n/strings';

export default function RuleEditor({ rule, type = 'expense', onClose }) {
    const { settings, doc, accounts, today } = useModel();
    const ruleType = rule?.type || type;
    const [name, setName] = useState(rule?.name || '');
    const [currency, setCurrency] = useState(rule?.currency || (ruleType === 'income' ? settings.displayCurrency : settings.spendingCurrency));
    const [amountText, setAmountText] = useState(rule ? minorToInput(rule.amount, rule.currency) : '');
    const [categoryId, setCategoryId] = useState(rule?.categoryId || (ruleType === 'income' ? 'cat_salary' : 'cat_other'));
    const [accountId, setAccountId] = useState(rule?.accountId || '');
    const [day, setDay] = useState(String(rule?.dayOfMonth || 1));
    const [startMonth, setStartMonth] = useState(rule?.startMonth || monthOf(today));
    const [endMonth, setEndMonth] = useState(rule?.endMonth || '');
    const [variable, setVariable] = useState(Boolean(rule?.variable));
    const [error, setError] = useState(null);

    const categories = list(doc, 'categories').filter((c) => Boolean(c.income) === (ruleType === 'income'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const save = () => {
        const amount = parseMoney(amountText, currency);
        const dayOfMonth = Number(day);
        if (!name.trim()) { setError(S.common.required); return; }
        if (!amount || amount <= 0 || !(dayOfMonth >= 1 && dayOfMonth <= 31)) { setError(S.common.invalidAmount); return; }
        saveRecord('rules', {
            ...(rule || {}), type: ruleType, name: name.trim(), amount, currency, categoryId,
            accountId: accountId || null, dayOfMonth, startMonth, endMonth: endMonth || null, variable,
        }, 'rule');
        toast(S.tx.saved);
        onClose();
    };

    const remove = () => {
        if (!window.confirm(S.common.deleteConfirm(rule.name))) return;
        deleteRecord('rules', rule.id);
        onClose();
    };

    return (
        <Sheet
            title={rule ? S.rule.editTitle : ruleType === 'income' ? S.rule.newIncome : S.rule.newBill}
            onClose={onClose}
            footer={<SheetActions onSave={save} onDelete={rule ? remove : null} />}
        >
            <div className="flex flex-col gap-4">
                {error && <p className="text-[14px] text-hot">{error}</p>}
                <Field label={S.common.name}>
                    {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!rule} />}
                </Field>
                <Field label={S.common.amount}>
                    <AmountInput value={amountText} onChange={setAmountText} currency={currency} currencies={settings.currencies} onCurrencyChange={setCurrency} />
                </Field>
                <Toggle checked={variable} onChange={setVariable} label={S.rule.variable} />
                <div className="grid grid-cols-2 gap-3">
                    <Field label={S.common.category}>
                        <Select value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
                    </Field>
                    <Field label={S.rule.dayOfMonth}>
                        <TextInput inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                </div>
                <Field label={S.rule.account}>
                    <Select
                        value={accountId}
                        onChange={setAccountId}
                        options={[{ value: '', label: S.rule.accountNone }, ...accounts.filter((a) => a.kind !== 'investment').map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))]}
                    />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={S.rule.startMonth}>
                        <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="h-12 w-full border border-line-strong bg-field px-3 font-mono text-white outline-none focus:border-neon" />
                    </Field>
                    <Field label={S.rule.endMonth}>
                        <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="h-12 w-full border border-line-strong bg-field px-3 font-mono text-white outline-none focus:border-neon" />
                    </Field>
                </div>
            </div>
        </Sheet>
    );
}
