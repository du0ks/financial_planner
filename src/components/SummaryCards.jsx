import React from 'react';
import { formatMoney } from '../utils/format';
import { TrendingUp, TrendingDown, CreditCard, Wallet, DollarSign } from 'lucide-react';

export default function SummaryCards({ totals, currency }) {
    const { totalLimit, totalDebt, totalAssets, overallNet, ccNet } = totals;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">

            {/* Net Worth - Hero Card */}
            <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 rounded-2xl p-6 text-white shadow-xl shadow-gray-900/10 dark:shadow-black/30">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Wallet size={120} />
                </div>
                <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Total Net Worth</p>
                    <h2 className="text-4xl font-bold tracking-tight mb-4">
                        {formatMoney(overallNet, currency)}
                    </h2>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${overallNet >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {overallNet >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                        {overallNet >= 0 ? 'Healthy Financial Status' : 'Attention Needed'}
                    </div>
                </div>
            </div>

            {/* Assets */}
            <StatCard
                label="Total Assets"
                amount={totalAssets}
                currency={currency}
                icon={<DollarSign className="text-blue-500" />}
                bgClass="bg-white dark:bg-gray-800"
            />

            {/* Debt */}
            <StatCard
                label="Total Debt"
                amount={totalDebt}
                currency={currency}
                isNegative
                icon={<TrendingDown className="text-red-500" />}
                bgClass="bg-white dark:bg-gray-800"
            />

            {/* Credit Card Net */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Credit Card Position</p>
                        <CreditCard className="text-purple-500" size={20} />
                    </div>
                    <p className={`text-2xl font-bold ${ccNet >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                        {formatMoney(ccNet, currency)}
                    </p>
                </div>
            </div>

        </div>
    );
}

function StatCard({ label, amount, currency, icon, isNegative, bgClass }) {
    return (
        <div className={`${bgClass} rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{label}</p>
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    {icon}
                </div>
            </div>
            <p className={`text-2xl font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {formatMoney(amount, currency)}
            </p>
        </div>
    )
}
