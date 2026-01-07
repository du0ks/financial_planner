import React from 'react';
import { Trash2 } from 'lucide-react';

export default function OtherTable({ others, updateOther, removeOther }) {
    return (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b dark:border-gray-600 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">
                    Other Payments (Rent, Tuition, Taxes)
                </h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm uppercase">
                            <th className="p-3 border-b dark:border-gray-600">Payment Name</th>
                            <th className="p-3 border-b dark:border-gray-600 w-40">Amount</th>
                            <th className="p-3 border-b dark:border-gray-600 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {others.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition">
                                <td className="p-3">
                                    <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => updateOther(item.id, 'name', e.target.value)}
                                        className="bg-transparent font-medium text-gray-800 dark:text-gray-200 w-full focus:outline-none focus:ring-1 p-1 rounded"
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        type="number"
                                        value={item.amount}
                                        onChange={(e) => updateOther(item.id, 'amount', e.target.value)}
                                        className="bg-transparent text-red-600 dark:text-red-400 font-semibold w-full focus:outline-none focus:ring-1 p-1 rounded"
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <button onClick={() => removeOther(item.id)} className="text-gray-400 hover:text-red-500 dark:text-gray-500 hover:bg-red-50 p-2 rounded transition">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
