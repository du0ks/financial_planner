import React from 'react';
import { Trash2, CreditCard, ChevronRight } from 'lucide-react';
import { formatMoney } from '../utils/format';

export default function CardTable({ cards, updateCard, removeCard }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {cards.map((card) => {
                const money = parseFloat(card.money) || 0;
                const debt = parseFloat(card.debt) || 0;
                const limit = parseFloat(card.limit) || 0;
                const remainingLimit = limit - debt;
                const cardNet = money - debt;

                return (
                    <div
                        key={card.id}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:shadow-md group flex flex-col"
                    >
                        {/* Card Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                                    <CreditCard size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={card.name}
                                    onChange={(e) => updateCard(card.id, 'name', e.target.value)}
                                    className="bg-transparent font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-0 text-lg w-full"
                                    placeholder="Card Name"
                                />
                            </div>
                            <button
                                onClick={() => removeCard(card.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-4">
                            <StatsInput
                                label="Limit"
                                value={card.limit}
                                onChange={(v) => updateCard(card.id, 'limit', v)}
                                color="text-gray-500"
                            />
                            <StatsInput
                                label="In Bank"
                                value={card.money}
                                onChange={(v) => updateCard(card.id, 'money', v)}
                                color="text-blue-600 dark:text-blue-400"
                            />
                            <StatsInput
                                label="Debt"
                                value={card.debt}
                                onChange={(v) => updateCard(card.id, 'debt', v)}
                                color="text-red-500"
                            />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Available</span>
                                <span className={`text-md font-mono font-bold ${remainingLimit < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                    {formatMoney(remainingLimit)}
                                </span>
                            </div>
                        </div>

                        {/* Bottom Net Status */}
                        <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-400 italic">Net Position</span>
                            <span className={`text-lg font-mono font-extrabold ${cardNet < 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>
                                {cardNet > 0 ? '+' : ''}{formatMoney(cardNet)}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function StatsInput({ label, value, onChange, color }) {
    return (
        <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">{label}</label>
            <div className="flex items-center">
                <span className={`text-xs mr-1 opacity-40 font-mono ${color}`}>₺</span>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`bg-transparent font-mono font-bold text-md w-full focus:outline-none ${color}`}
                />
            </div>
        </div>
    )
}
