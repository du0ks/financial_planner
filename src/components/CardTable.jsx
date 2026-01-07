import React from 'react';
import { Trash2, CreditCard } from 'lucide-react';
import { formatMoney } from '../utils/format';

export default function CardTable({ cards, updateCard, removeCard }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                        <CreditCard size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        Credit Cards
                    </h2>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                            <th className="p-4 pl-6">Card Identity</th>
                            <th className="p-4 w-32">Limit</th>
                            <th className="p-4 w-32">In Bank</th>
                            <th className="p-4 w-32">Debt</th>
                            <th className="p-4 w-40">Available</th>
                            <th className="p-4 w-40">Net Status</th>
                            <th className="p-4 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {cards.map((card) => {
                            const money = parseFloat(card.money) || 0;
                            const debt = parseFloat(card.debt) || 0;
                            const limit = parseFloat(card.limit) || 0;
                            const remainingLimit = limit - debt;
                            const cardNet = money - debt;

                            return (
                                <tr key={card.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <td className="p-4 pl-6">
                                        <input
                                            type="text"
                                            value={card.name}
                                            onChange={(e) => updateCard(card.id, 'name', e.target.value)}
                                            className="bg-transparent font-medium text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:text-green-600 placeholder-gray-300"
                                            placeholder="Card Name"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="number"
                                            value={card.limit}
                                            onChange={(e) => updateCard(card.id, 'limit', e.target.value)}
                                            className="bg-transparent text-gray-500 dark:text-gray-400 w-full focus:outline-none focus:text-green-600 font-mono text-sm"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="number"
                                            value={card.money}
                                            onChange={(e) => updateCard(card.id, 'money', e.target.value)}
                                            className="bg-transparent text-blue-600 dark:text-blue-400 font-semibold w-full focus:outline-none focus:bg-blue-50/50 rounded py-1 font-mono text-sm"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="number"
                                            value={card.debt}
                                            onChange={(e) => updateCard(card.id, 'debt', e.target.value)}
                                            className="bg-transparent text-red-500 dark:text-red-400 font-semibold w-full focus:outline-none focus:bg-red-50/50 rounded py-1 font-mono text-sm"
                                        />
                                    </td>
                                    <td className={`p-4 font-mono text-sm font-medium ${remainingLimit < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                        {formatMoney(remainingLimit)}
                                    </td>
                                    <td className={`p-4 font-mono text-sm font-medium ${cardNet < 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>
                                        {cardNet > 0 ? '+' : ''}{formatMoney(cardNet)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => removeCard(card.id)}
                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
