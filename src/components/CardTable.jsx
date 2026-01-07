import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatMoney } from '../utils/format';

export default function CardTable({ cards, updateCard, removeCard }) {
    return (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b dark:border-gray-600 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">
                    Credit Cards & Debts
                </h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm uppercase">
                            <th className="p-3 border-b dark:border-gray-600">Card / Account Name</th>
                            <th className="p-3 border-b dark:border-gray-600 w-28">Limit</th>
                            <th className="p-3 border-b dark:border-gray-600 w-32">Current Money</th>
                            <th className="p-3 border-b dark:border-gray-600 w-32">Current Debt</th>
                            <th className="p-3 border-b dark:border-gray-600 w-40">Remaining Limit</th>
                            <th className="p-3 border-b dark:border-gray-600 w-40">Card Net (+ / -)</th>
                            <th className="p-3 border-b dark:border-gray-600 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {cards.map((card) => {
                            const money = parseFloat(card.money) || 0;
                            const debt = parseFloat(card.debt) || 0;
                            const limit = parseFloat(card.limit) || 0;
                            const remainingLimit = limit - debt;
                            const cardNet = money - debt;

                            return (
                                <tr key={card.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition">
                                    <td className="p-3">
                                        <input
                                            type="text"
                                            value={card.name}
                                            onChange={(e) => updateCard(card.id, 'name', e.target.value)}
                                            className="bg-transparent font-medium text-gray-800 dark:text-gray-200 w-full focus:outline-none focus:ring-1 p-1 rounded"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            value={card.limit}
                                            onChange={(e) => updateCard(card.id, 'limit', e.target.value)}
                                            className="bg-transparent text-gray-600 dark:text-gray-400 w-full focus:outline-none focus:ring-1 p-1 rounded"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            value={card.money}
                                            onChange={(e) => updateCard(card.id, 'money', e.target.value)}
                                            className="bg-transparent text-blue-600 dark:text-blue-400 font-semibold w-full focus:outline-none focus:ring-1 p-1 rounded"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            value={card.debt}
                                            onChange={(e) => updateCard(card.id, 'debt', e.target.value)}
                                            className="bg-transparent text-red-600 dark:text-red-400 font-semibold w-full focus:outline-none focus:ring-1 p-1 rounded"
                                        />
                                    </td>
                                    <td className={`p-3 font-mono text-sm ${remainingLimit < 0 ? 'text-red-500 font-bold' : 'text-green-600 dark:text-green-400'}`}>
                                        {formatMoney(remainingLimit)}
                                    </td>
                                    <td className={`p-3 font-mono text-sm ${cardNet < 0 ? 'text-red-600 font-bold' : 'text-green-600 dark:text-green-400'}`}>
                                        {cardNet > 0 ? '+' : ''}{formatMoney(cardNet)}
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => removeCard(card.id)} className="text-gray-400 hover:text-red-500 dark:text-gray-500 hover:bg-red-50 p-2 rounded transition">
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
