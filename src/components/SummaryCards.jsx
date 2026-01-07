import React from 'react';
import { formatMoney } from '../utils/format';

export default function SummaryCards({ totals }) {
    const { totalLimit, totalDebt, totalAssets, overallNet, ccNet } = totals;

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-8">
            {/* Total Debt */}
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900 flex flex-col">
                <p className="text-red-600 dark:text-red-400 text-xs font-bold uppercase text-center">Total Debt</p>
                <div className="mt-1 w-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {formatMoney(totalDebt)}
                    </span>
                </div>
            </div>

            {/* Total Assets */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900 flex flex-col">
                <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase text-center">Total Assets (Cash + Cards)</p>
                <div className="mt-1 w-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {formatMoney(totalAssets)}
                    </span>
                </div>
            </div>

            {/* Total Limit */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col">
                <p className="text-gray-600 dark:text-gray-300 text-xs font-bold uppercase text-center">Total Card Limit</p>
                <div className="mt-1 w-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                        {formatMoney(totalLimit)}
                    </span>
                </div>
            </div>

            {/* Credit Card Position */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900 flex flex-col">
                <p className="text-purple-700 dark:text-purple-400 text-xs font-bold uppercase text-center">Overall Credit Card Position</p>
                <div className="mt-1 w-full flex items-center justify-center">
                    <span className={`text-2xl font-bold ${ccNet > 0 ? 'text-green-700 dark:text-green-300' : ccNet < 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {ccNet > 0 ? '+' : ''}{formatMoney(ccNet)}
                    </span>
                </div>
                <p className="text-xs mt-2 text-purple-700 dark:text-purple-400 text-center">
                    Calculated from all cards.
                </p>
            </div>

            {/* Net Worth */}
            <div className={`p-4 rounded-lg border shadow-sm relative overflow-hidden flex flex-col ${overallNet >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900'}`}>
                <p className={`text-xs font-bold uppercase text-center ${overallNet >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                    Overall Net Position
                </p>
                <div className="mt-1 w-full flex items-center justify-center">
                    <span className={`text-2xl font-bold ${overallNet >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {overallNet > 0 ? '+' : ''}{formatMoney(overallNet)}
                    </span>
                </div>
                <p className={`text-xs mt-2 text-center ${overallNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {overallNet >= 0 ? 'Status: Positive' : 'Status: Negative'}
                </p>
            </div>
        </div>
    );
}
