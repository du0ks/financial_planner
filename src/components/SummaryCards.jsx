import React from 'react';
import { formatMoney } from '../utils/format';
import { TrendingUp, TrendingDown, CreditCard, Wallet, DollarSign, Coins } from 'lucide-react';

const getDynamicFontSize = (val) => {
    const len = String(val).length;
    if (len > 18) return 'text-base';
    if (len > 15) return 'text-lg';
    if (len > 12) return 'text-xl';
    return 'text-2xl';
};

export default function SummaryCards({ totals, currency }) {
    const { totalLimit, totalDebt, totalAssets, overallNet, ccNet } = totals;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">

            {/* Net Worth - Hero Card */}
            <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 dark:from-black dark:via-gray-900 dark:to-black rounded-[32px] p-8 text-white shadow-xl shadow-gray-950/20">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Wallet size={120} />
                </div>
                <div className="relative z-10 flex flex-col items-start">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-3 opacity-60">Total Net Worth</p>
                    <h2 className={`font-black tracking-tighter mb-5 leading-none transition-all ${getDynamicFontSize(formatMoney(overallNet, currency)) === 'text-2xl' ? 'text-5xl' : 'text-3xl'}`}>
                        {formatMoney(overallNet, currency)}
                    </h2>
                    <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${overallNet >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {overallNet >= 0 ? <TrendingUp size={12} className="mr-2" /> : <TrendingDown size={12} className="mr-2" />}
                        {overallNet >= 0 ? 'Stable Assets' : 'Debt Risk'}
                    </div>
                </div>
            </div>

            {/* Assets */}
            <StatCard
                label="Total Assets"
                amount={totalAssets}
                currency={currency}
                icon={<DollarSign size={16} className="text-blue-500" />}
                bgClass="bg-white dark:bg-gray-900"
            />

            {/* Debt */}
            <StatCard
                label="Total Debt"
                amount={totalDebt}
                currency={currency}
                isNegative
                icon={<TrendingDown size={16} className="text-red-500" />}
                bgClass="bg-white dark:bg-gray-900"
            />

            {/* Credit Card Net */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between hover:border-purple-500/20 transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Card Position</p>
                    <div className="p-2 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform">
                        <CreditCard className="text-purple-500" size={16} />
                    </div>
                </div>
                <p className={`font-black tracking-tight leading-none ${ccNet >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'} ${getDynamicFontSize(formatMoney(ccNet, currency))}`}>
                    {formatMoney(ccNet, currency)}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Limit Health</span>
                    <span className="text-[10px] font-black text-purple-600">Active</span>
                </div>
            </div>

        </div>
    );
}

function StatCard({ label, amount, currency, icon, isNegative, bgClass }) {
    const formattedValue = formatMoney(amount, currency);
    return (
        <div className={`${bgClass} rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between hover:shadow-md transition-all group`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">{label}</p>
                <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${isNegative ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                    {icon}
                </div>
            </div>
            <p className={`font-black tracking-tight leading-none ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'} ${getDynamicFontSize(formattedValue)}`}>
                {formattedValue}
            </p>
            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Current Stat</span>
                <div className={`w-1.5 h-1.5 rounded-full ${isNegative ? 'bg-red-500' : 'bg-blue-500'} animate-pulse`} />
            </div>
        </div>
    )
}
