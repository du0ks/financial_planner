import React from 'react';
import { ArrowUpRight, ChevronDown, Trash2 } from 'lucide-react';
import { parseCloudNumber } from '../utils/format';

const CURRENCY_SYMBOLS = { TRY: 'TRY', UAH: 'UAH', USD: 'USD', EUR: 'EUR' };
const CONTROL_CLASS = 'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export default function IncomeTable({ incomes, updateIncome, removeIncome, currency }) {
    return (
        <div className="space-y-3 mb-8">
            {incomes.map((income) => (
                <div
                    key={income.id}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                            <div className="rounded-xl bg-green-50 p-2 text-green-500 dark:bg-green-900/20">
                                <ArrowUpRight size={18} />
                            </div>
                            <input
                                type="text"
                                value={income.name}
                                onChange={(event) => updateIncome(income.id, 'name', event.target.value)}
                                className="w-full min-w-0 bg-transparent font-semibold text-gray-800 outline-none dark:text-gray-100"
                                placeholder="Income Name"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(income.isRecurring)}
                                    onChange={(event) => updateIncome(income.id, 'isRecurring', event.target.checked)}
                                    className="accent-green-500"
                                />
                                {income.isRecurring ? 'Monthly' : 'One-time'}
                            </label>
                            <div className="flex items-center font-mono text-lg font-bold text-green-600 dark:text-green-400">
                                <span className="mr-1 text-sm font-normal opacity-50">{CURRENCY_SYMBOLS[income.currency || currency]}</span>
                                <AmountInput
                                    value={income.amount}
                                    onChange={(value) => updateIncome(income.id, 'amount', parseCloudNumber(value))}
                                />
                            </div>
                            <button
                                onClick={() => removeIncome(income.id)}
                                className="rounded-lg p-1 text-gray-300 transition-all hover:text-red-500"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <details className="mt-3 rounded-2xl bg-green-50/50 dark:bg-green-900/10 group/details">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-green-500">
                            Income Schedule
                            <ChevronDown size={14} className="transition-transform group-open/details:rotate-180" />
                        </summary>
                        <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-3">
                            <Field label="Currency">
                                <select
                                    value={income.currency || currency}
                                    onChange={(event) => updateIncome(income.id, 'currency', event.target.value)}
                                    className={CONTROL_CLASS}
                                >
                                    {Object.keys(CURRENCY_SYMBOLS).map(code => <option key={code} value={code}>{code}</option>)}
                                </select>
                            </Field>
                            <Field label={income.isRecurring ? 'Next Occurrence' : 'Date'}>
                                <input
                                    type="date"
                                    value={income.date || ''}
                                    onChange={(event) => updateIncome(income.id, 'date', event.target.value)}
                                    className={CONTROL_CLASS}
                                />
                            </Field>
                            {income.isRecurring ? (
                                <Field label="Recurrence Day">
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={income.recurrenceDay || 1}
                                        onChange={(event) => updateIncome(income.id, 'recurrenceDay', Math.min(31, Math.max(1, parseCloudNumber(event.target.value) || 1)))}
                                        className={`${CONTROL_CLASS} font-mono`}
                                    />
                                </Field>
                            ) : (
                                <Field label="End Date">
                                    <input
                                        type="date"
                                        value={income.endDate || ''}
                                        onChange={(event) => updateIncome(income.id, 'endDate', event.target.value || null)}
                                        className={CONTROL_CLASS}
                                    />
                                </Field>
                            )}
                            {income.isRecurring && (
                                <Field label="End Date">
                                    <input
                                        type="date"
                                        value={income.endDate || ''}
                                        onChange={(event) => updateIncome(income.id, 'endDate', event.target.value || null)}
                                        className={CONTROL_CLASS}
                                    />
                                </Field>
                            )}
                        </div>
                    </details>
                </div>
            ))}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
            {children}
        </label>
    );
}

function AmountInput({ value, onChange }) {
    const [localValue, setLocalValue] = React.useState(value);

    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <input
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            onBlur={() => onChange(localValue)}
            className="w-24 border-b border-transparent bg-transparent text-right outline-none focus:border-green-200"
        />
    );
}
