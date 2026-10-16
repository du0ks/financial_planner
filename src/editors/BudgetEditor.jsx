import { useState } from 'react';
import { useModel } from '../state/hooks';
import { saveBudget } from '../state/actions';
import { get, list } from '../lib/doc';
import { minorToInput, parseMoney } from '../lib/money';
import { AmountInput, Button, Field, Select, Sheet, toast } from '../ui/kit';
import S from '../i18n/strings';

export default function BudgetEditor({ categoryId: initialCategory, onClose }) {
    const { settings, doc } = useModel();
    const [categoryId, setCategoryId] = useState(initialCategory || '');
    const existing = list(doc, 'budgets').find((b) => b.categoryId === categoryId);
    const [currency, setCurrency] = useState(existing?.currency || settings.spendingCurrency);
    const [amountText, setAmountText] = useState(existing ? minorToInput(existing.amount, existing.currency) : '');
    const [error, setError] = useState(null);
    const categories = list(doc, 'categories').filter((c) => !c.income).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const pick = (id) => {
        setCategoryId(id);
        const budget = list(doc, 'budgets').find((b) => b.categoryId === id);
        setCurrency(budget?.currency || settings.spendingCurrency);
        setAmountText(budget ? minorToInput(budget.amount, budget.currency) : '');
    };

    const save = () => {
        const amount = parseMoney(amountText, currency);
        if (!categoryId || !amount || amount <= 0) { setError(S.common.invalidAmount); return; }
        saveBudget(categoryId, amount, currency);
        toast(S.tx.saved);
        onClose();
    };

    const category = get(doc, 'categories', categoryId);
    return (
        <Sheet
            title={category ? S.plan.budgetFor(category.name) : S.plan.setBudget}
            onClose={onClose}
            footer={(
                <div className="flex gap-3">
                    {existing && <Button variant="danger" onClick={() => { saveBudget(categoryId, null); onClose(); }}>{S.plan.removeBudget}</Button>}
                    <Button variant="primary" className="flex-1" onClick={save}>{S.common.save}</Button>
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                {!initialCategory && (
                    <Field label={S.common.category}>
                        <Select value={categoryId} onChange={pick} options={[{ value: '', label: '—' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                    </Field>
                )}
                <Field label={S.common.perMonth} error={error}>
                    <AmountInput autoFocus value={amountText} onChange={(v) => { setAmountText(v); setError(null); }} currency={currency} currencies={settings.currencies} onCurrencyChange={setCurrency} />
                </Field>
            </div>
        </Sheet>
    );
}
