import React from 'react';
import { Trash2, PiggyBank } from 'lucide-react';
import { formatMoney, parseCloudNumber } from '../utils/format';

const CURRENCY_SYMBOLS = { TRY: '₺', UAH: '₴', USD: '$', EUR: '€' };

export default function FundTable({ funds, updateFund, removeFund, currency }) {
    return (
        <div className="space-y-3 mb-8">
            {funds.map((fund) => (
                <div
                    key={fund.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-800 group transition-all hover:bg-gray-50/50 dark:hover:bg-gray-700/30"
                >
                    <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-500">
                            <PiggyBank size={18} />
                        </div>
                        <input
                            type="text"
                            value={fund.name}
                            onChange={(e) => updateFund(fund.id, 'name', e.target.value)}
                            className="bg-transparent font-semibold text-gray-800 dark:text-gray-100 focus:outline-none w-full"
                            placeholder="Asset Name"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="flex items-center justify-end text-blue-600 dark:text-blue-400 font-bold font-mono text-lg">
                                <span className="text-sm mr-1 opacity-50 font-normal">{CURRENCY_SYMBOLS[currency]}</span>
                                <AmountInput
                                    value={fund.amount}
                                    onChange={(v) => updateFund(fund.id, 'amount', parseCloudNumber(v))}
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => removeFund(fund.id)}
                            className="text-gray-300 hover:text-red-500 p-1 rounded-lg transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
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
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue)}
            className="bg-transparent text-right w-24 focus:outline-none border-b border-transparent focus:border-blue-200"
        />
    );
}
