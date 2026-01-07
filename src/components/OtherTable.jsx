import React from 'react';
import { Trash2, FileText } from 'lucide-react';

export default function OtherTable({ others, updateOther, removeOther }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                        <FileText size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        Fixed Payments
                    </h2>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                            <th className="p-4 pl-6">Payment Description</th>
                            <th className="p-4 w-40">Cost</th>
                            <th className="p-4 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {others.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                                <td className="p-4 pl-6">
                                    <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => updateOther(item.id, 'name', e.target.value)}
                                        className="bg-transparent font-medium text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:text-red-500 placeholder-gray-300"
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="number"
                                        value={item.amount}
                                        onChange={(e) => updateOther(item.id, 'amount', e.target.value)}
                                        className="bg-transparent text-red-600 dark:text-red-400 font-bold w-full focus:outline-none focus:bg-red-50/50 rounded py-1 font-mono"
                                    />
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => removeOther(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
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
