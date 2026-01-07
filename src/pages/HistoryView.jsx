import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { History as HistoryIcon, TrendingUp, TrendingDown, Trash2, Camera, Calendar, ArrowRight, Zap, Target, Award, Info, X } from 'lucide-react';
import { formatMoney } from '../utils/format';

export default function HistoryView({ data }) {
    const { history = [], saveSnapshot, deleteSnapshot, totals, currency } = data;
    const { velocity, momentum, allTimeHigh, overallNet, totalAssets, totalDebt } = totals;
    const [showInfo, setShowInfo] = useState(false);

    // Chart logic: Transform history into points
    // We include current state as the last point
    const currentState = {
        date: new Date().toISOString(),
        overallNet,
        totalAssets,
        totalDebt,
        currency
    };

    const chartData = [...[...history].reverse(), currentState];

    // Bounds for charting
    const allNetValues = chartData.map(s => s.overallNet);
    const allAssetValues = chartData.map(s => s.totalAssets);

    const maxVal = Math.max(...allAssetValues, 1000);
    const minVal = Math.min(...allNetValues, 0);
    const range = maxVal - minVal || 1;

    // Multi-layer SVG Chart logic
    const getPoints = (key) => {
        if (chartData.length < 2) return "";
        const width = 1000;
        const height = 200;
        const padding = 20;
        const plotWidth = width - padding * 2;
        const plotHeight = height - padding * 2;

        return chartData.map((s, i) => {
            const x = padding + (i / (chartData.length - 1)) * plotWidth;
            const y = height - (padding + ((s[key] - minVal) / range) * plotHeight);
            return `${x},${y}`;
        }).join(" ");
    };

    // Milestone calculation
    const getNextMilestone = (val) => {
        if (val <= 0) return 5000;
        const magnitudes = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
        return magnitudes.find(m => m > val) || val * 1.2;
    };
    const nextMilestone = getNextMilestone(overallNet);
    const milestoneProgress = Math.max(0, Math.min(100, (overallNet / nextMilestone) * 100));

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HistoryIcon className="text-green-500" />
                        Financial Vault
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Advanced analytics and snapshot-driven growth metrics.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    >
                        <Info size={20} />
                    </button>
                    <button
                        onClick={saveSnapshot}
                        className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95 text-sm"
                    >
                        <Camera size={18} />
                        Snapshot Progress
                    </button>
                </div>
            </div>

            {/* Explainer Modal */}
            {showInfo && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative border border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setShowInfo(false)}
                            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-500/10 rounded-xl">
                                    <Info className="text-green-500" size={24} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Finance Guide</h3>
                            </div>

                            <div className="space-y-5">
                                <div className="flex gap-3">
                                    <Zap size={18} className="text-blue-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 italic">Velocity</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                            How fast your money grows. It's the growth per day since your last snapshot.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <TrendingUp size={18} className="text-green-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 italic">Momentum</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                            Your average daily growth from the very start.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Award size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 italic">All-Time High</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                            The highest net worth you ever achieved.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Target size={18} className="text-purple-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 italic">Next Milestone</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                            Your next goal. We set round numbers for you to reach.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <Calendar size={14} /> When to snapshot?
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                                        Once a week or once a month is perfect. Regularity makes the charts accurate!
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInfo(false)}
                            className="w-full mt-8 bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-lg"
                        >
                            Got it!
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* Interactive Dashboard Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative group">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Multi-Layer Chart */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">The Growth Gap</h3>
                                <p className="text-xs text-gray-400 mt-1">Assets (Light) vs Net Worth (Dark)</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-green-500 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-md">
                                <Zap size={14} />
                                Live Analysis
                            </div>
                        </div>

                        {chartData.length >= 2 ? (
                            <div className="h-56 w-full relative">
                                <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>

                                    {/* Assets Layer */}
                                    <path
                                        d={`M ${getPoints('totalAssets').split(" ")[0].split(",")[0]},200 L ${getPoints('totalAssets')} L ${getPoints('totalAssets').split(" ").pop().split(",")[0]},200 Z`}
                                        fill="url(#assetGradient)"
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="2"
                                        strokeDasharray="4 4"
                                        strokeOpacity="0.5"
                                        points={getPoints('totalAssets')}
                                    />

                                    {/* Net Worth Layer */}
                                    <path
                                        d={`M ${getPoints('overallNet').split(" ")[0].split(",")[0]},200 L ${getPoints('overallNet')} L ${getPoints('overallNet').split(" ").pop().split(",")[0]},200 Z`}
                                        fill="url(#netGradient)"
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="#22c55e"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        points={getPoints('overallNet')}
                                    />
                                </svg>
                            </div>
                        ) : (
                            <div className="h-56 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-gray-700/50 rounded-2xl text-gray-400">
                                <TrendingUp size={48} className="mb-2 opacity-20" />
                                <p className="text-sm italic text-center px-6">Record your first snapshot to start visualizing the "Growth Gap" between your assets and debt.</p>
                            </div>
                        )}
                    </div>

                    {/* Snapshot Statistics */}
                    <div className="space-y-6 flex flex-col">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Snapshot Stats</h3>

                        <div className="grid grid-cols-1 gap-4 flex-1">
                            {/* Velocity Widget */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-transparent flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                                    <Zap size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Velocity</p>
                                    <p className="text-lg font-bold dark:text-white">
                                        {formatMoney(velocity, currency)}<span className="text-[10px] text-gray-400 ml-1">/ day</span>
                                    </p>
                                </div>
                            </div>

                            {/* Momentum Widget */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-transparent flex items-center gap-4">
                                <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Momentum</p>
                                    <p className="text-lg font-bold dark:text-white">
                                        {formatMoney(momentum, currency)}<span className="text-[10px] text-gray-400 ml-1">avg/ day</span>
                                    </p>
                                </div>
                            </div>

                            {/* ATH Widget */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-transparent flex items-center gap-4">
                                <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
                                    <Award size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">All-Time High</p>
                                    <p className="text-lg font-bold dark:text-white">
                                        {formatMoney(allTimeHigh, currency)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Milestone Footer */}
                <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-700/50">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <Target size={16} className="text-purple-500" />
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Next Milestone: {formatMoney(nextMilestone, currency)}</span>
                        </div>
                        <span className="text-xs font-bold text-purple-500">{milestoneProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000"
                            style={{ width: `${milestoneProgress}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Timeline Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 px-2 opacity-50">Discovery Timeline</h3>
                {history.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                        <Calendar className="mx-auto text-gray-300 mb-4 opacity-30" size={56} />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Your financial story starts here.</p>
                        <p className="text-xs text-gray-400 mt-1">Take a snapshot to record your current progress.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {history.map((snapshot) => (
                            <div
                                key={snapshot.id}
                                className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 group hover:shadow-md transition-all relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                            <Calendar size={18} className="text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                                                {new Date(snapshot.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-mono">
                                                {new Date(snapshot.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteSnapshot(snapshot.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex items-end justify-between border-t border-gray-50 dark:border-gray-700/50 pt-5 mt-2 relative z-10">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Net Worth</p>
                                        <p className={`text-xl font-bold font-mono ${snapshot.overallNet >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                                            {formatMoney(snapshot.overallNet, snapshot.currency)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Growth Gap</p>
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="text-xs font-bold text-blue-500">{formatMoney(snapshot.totalAssets, snapshot.currency)}</span>
                                            <ArrowRight size={10} className="text-gray-300" />
                                            <span className="text-xs font-bold text-red-500">{formatMoney(snapshot.totalDebt, snapshot.currency)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Subtlest Background Accent */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-50 to-transparent dark:from-gray-700/20 opacity-50 -mr-8 -mt-8 rounded-full pointer-events-none"></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
