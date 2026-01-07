import React from 'react';
import { History as HistoryIcon, TrendingUp, TrendingDown, Trash2, Camera, Calendar, ArrowRight } from 'lucide-react';
import { formatMoney } from '../utils/format';

export default function HistoryView({ data }) {
    const { history, saveSnapshot, deleteSnapshot, totals, currency } = data;

    // Chart logic: Transform history into points
    const chartData = [...history].reverse();
    const maxVal = Math.max(...chartData.map(s => Math.abs(s.overallNet)), Math.abs(totals.overallNet), 1000);
    const minVal = Math.min(...chartData.map(s => s.overallNet), totals.overallNet, 0);

    // Simple SVG Area Chart logic
    const getPoints = () => {
        if (chartData.length < 2) return "";
        const width = 1000;
        const height = 200;
        const padding = 20;
        const plotWidth = width - padding * 2;
        const plotHeight = height - padding * 2;

        const points = chartData.map((s, i) => {
            const x = padding + (i / (chartData.length - 1)) * plotWidth;
            const y = height - (padding + ((s.overallNet - minVal) / (maxVal - minVal)) * plotHeight);
            return `${x},${y}`;
        });

        return points.join(" ");
    };

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HistoryIcon className="text-green-500" />
                        Financial History
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Track your net worth progression and analyze trends.
                    </p>
                </div>
                <button
                    onClick={saveSnapshot}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95 text-sm"
                >
                    <Camera size={18} />
                    Snapshot Current State
                </button>
            </div>

            {/* Interactive Dashboard Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <TrendingUp size={160} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Trend Chart */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Net Worth Trend</h3>
                            <div className="flex items-center gap-2 text-xs font-bold text-green-500 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-md">
                                <TrendingUp size={14} />
                                Visualization
                            </div>
                        </div>

                        {chartData.length >= 2 ? (
                            <div className="h-48 w-full">
                                <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d={`M ${getPoints().split(" ")[0].split(",")[0]},200 L ${getPoints()} L ${getPoints().split(" ").pop().split(",")[0]},200 Z`}
                                        fill="url(#areaGradient)"
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="#22c55e"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        points={getPoints()}
                                    />
                                </svg>
                            </div>
                        ) : (
                            <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-gray-700/50 rounded-2xl text-gray-400">
                                <p className="text-sm italic">Take at least 2 snapshots to see trends</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Analysis */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Analysis</h3>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Asset/Debt Ratio</p>
                                <div className="flex items-end justify-between mb-2">
                                    <span className="text-xl font-bold dark:text-white">
                                        {((totals.totalAssets / (totals.totalDebt || 1)) * 100).toFixed(0)}%
                                    </span>
                                    <span className="text-xs font-medium text-green-500">Coverage</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-1000"
                                        style={{ width: `${Math.min((totals.totalAssets / (totals.totalDebt || 1)) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Total Points</p>
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl font-bold dark:text-white">{history.length}</div>
                                    <div className="text-xs text-gray-400">Snapshots recorded in your local vault</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 px-2 opacity-50">Timeline</h3>
                {history.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                        <Calendar className="mx-auto text-gray-300 mb-3" size={40} />
                        <p className="text-gray-500 dark:text-gray-400">No snapshots yet. Start tracking your journey!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {history.map((snapshot) => (
                            <div
                                key={snapshot.id}
                                className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 group hover:shadow-md transition-all"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                                            <Calendar size={18} className="text-gray-500 dark:text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">
                                                {new Date(snapshot.date).toLocaleDateString()}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(snapshot.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteSnapshot(snapshot.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="flex items-end justify-between border-t border-gray-50 dark:border-gray-700/50 pt-4 mt-2">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Snap Net Worth</p>
                                        <p className={`text-xl font-bold font-mono ${snapshot.overallNet >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                                            {formatMoney(snapshot.overallNet, snapshot.currency)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Debt Level</p>
                                        <p className="text-sm font-bold text-red-500">
                                            {formatMoney(snapshot.totalDebt, snapshot.currency)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
