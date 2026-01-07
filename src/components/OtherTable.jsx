import React from 'react';
import { Trash2, ArrowDownRight } from 'lucide-react';

const CURRENCY_SYMBOLS = { TRY: '₺', UAH: '₴', USD: '$', EUR: '€' };

export default function OtherTable({ others, updateOther, removeOther, currency }) {
    return (
        <div className="space-y-3 mb-8">
            {others.map((item) => (
                <div
                    key={item.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-800 group transition-all hover:bg-gray-50/50 dark:hover:bg-gray-700/30"
                >
                    <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-500">
                            <ArrowDownRight size={18} />
                        </div>
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateOther(item.id, 'name', e.target.value)}
                            className="bg-transparent font-semibold text-gray-800 dark:text-gray-100 focus:outline-none w-full"
                            placeholder="Expense Name"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="flex items-center justify-end text-red-600 dark:text-red-400 font-bold font-mono text-lg">
                                <span className="text-sm mr-1 opacity-50 font-normal">{CURRENCY_SYMBOLS[currency]}</span>
                                <input
                                    type="number"
                                    value={item.amount}
                                    onChange={(e) => updateOther(item.id, 'amount', e.target.value)}
                                    className="bg-transparent text-right w-24 focus:outline-none border-b border-transparent focus:border-red-200"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => removeOther(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 rounded-lg transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
