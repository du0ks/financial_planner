import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Coins, TrendingUp, Wallet, ArrowRight, Sparkles, Scale, History, Plus, Minus, Info, X, Zap, Target, Award, ShieldCheck, Timer, BarChart3 } from 'lucide-react';
import { formatMoney } from '../utils/format';

export default function InvestmentsView({ data }) {
    const { goldGrams, setGoldGrams, goldValue, goldPricePerGram, currency, totals, goldChanges } = data;
    const { totalAssets } = totals; // Note: this is assets EXCLUDING gold
    const [inputGrams, setInputGrams] = useState('');
    const [showInfo, setShowInfo] = useState(false);

    // Calculate Real Portfolio Weight
    const portfolioWeight = useMemo(() => {
        const totalWealth = (totalAssets || 0) + (goldValue || 0);
        if (totalWealth === 0) return 0;
        return (goldValue / totalWealth) * 100;
    }, [totalAssets, goldValue]);

    const handleAdd = () => {
        const val = parseFloat(inputGrams) || 0;
        setGoldGrams(prev => prev + val);
        setInputGrams('');
    };

    const handleRemove = () => {
        const val = parseFloat(inputGrams) || 0;
        setGoldGrams(prev => Math.max(0, prev - val));
        setInputGrams('');
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in">
            {/* Header / Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-900 via-yellow-800 to-amber-950 rounded-[40px] p-8 text-white shadow-2xl shadow-amber-900/30">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                                <Coins size={20} className="text-yellow-400" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-yellow-200/80">Gold Reserves</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-1">
                            {formatMoney(goldValue, currency)}
                        </h2>
                        <div className="flex items-center gap-2 text-yellow-200/90 font-medium">
                            <Scale size={16} />
                            <span>{goldGrams.toFixed(2)} grams total</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <button
                            onClick={() => setShowInfo(true)}
                            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors mb-2"
                        >
                            <Info size={20} />
                        </button>
                        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-right">
                            <p className="text-xs font-bold uppercase tracking-widest text-yellow-200/70 mb-1">Live Market Price</p>
                            <p className="text-2xl font-black font-mono">
                                {formatMoney(goldPricePerGram, currency)}
                                <span className="text-sm font-medium ml-1">/ gram</span>
                            </p>
                            <div className="flex items-center justify-end gap-1 text-[10px] mt-1 text-green-400 font-bold uppercase">
                                <TrendingUp size={10} />
                                <span>Real-time updated</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute -top-12 -right-12 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl"></div>
                <Sparkles className="absolute top-8 right-12 text-yellow-200/10 animate-pulse" size={120} />
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
                                <div className="p-2 bg-yellow-500/10 rounded-xl">
                                    <ShieldCheck className="text-yellow-600" size={24} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tighter">Your Investment Engine</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                                        <TrendingUp size={16} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 uppercase tracking-tighter">Real-Time Valuation</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal mt-1">
                                            We track global <span className="text-amber-600 font-bold">XAU/USD</span> rates live. Your grams are instantly converted using current FX rates into {currency}.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                        <BarChart3 size={16} className="text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 uppercase tracking-tighter">Performance Cards</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal mt-1">
                                            These show how gold has moved in the last 24h, 1W, 1M, and 1Y. It calculates exactly how much your <span className="font-bold">actual holdings</span> gained or lost.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <Scale size={16} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-gray-100 uppercase tracking-tighter">Portfolio Weighting</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal mt-1">
                                            Displays what percentage of your total wealth (Cash + Gold) is held in investments, helping you balance your risk.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl">
                                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-[0.1em] mb-1 flex items-center gap-2">
                                            <Zap size={10} /> Strategic Note
                                        </p>
                                        <p className="text-[11px] text-amber-900/70 dark:text-amber-200/60 leading-relaxed italic">
                                            "Investment value is hidden from your main dashboard to treat it as a true safe-haven reserve that grows independently of your daily spending."
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowInfo(false)}
                                className="w-full bg-gradient-to-br from-amber-900 to-amber-950 text-white font-black py-5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-amber-900/20 uppercase tracking-[0.2em] text-xs"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Manual Transaction Card */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-xl border border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Manage Physical Gold</h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Amount (Grams)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={inputGrams}
                                onChange={(e) => setInputGrams(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-5 px-6 text-xl font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-600 transition-all outline-none"
                                placeholder="0.00"
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleAdd}
                                className="w-full bg-gradient-to-br from-amber-900 via-yellow-800 to-amber-950 hover:from-amber-800 hover:to-amber-900 text-white font-black py-5 rounded-2xl shadow-xl shadow-amber-900/20 transition-all active:scale-95 flex items-center justify-center gap-3 group"
                            >
                                <div className="p-1.5 bg-white/10 rounded-lg group-hover:scale-110 transition-transform">
                                    <Plus size={20} className="text-yellow-400" />
                                </div>
                                <span className="uppercase tracking-[0.2em] text-sm">Add Gold</span>
                            </button>

                            <button
                                onClick={handleRemove}
                                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700"
                            >
                                <Minus size={18} className="text-gray-500" />
                                <span className="uppercase tracking-widest text-xs">Sell / Use</span>
                            </button>
                        </div>
                    </div>

                    <p className="text-[10px] text-gray-400 mt-8 leading-relaxed italic text-center uppercase tracking-tighter">
                        Data is synced securely to your private cloud portfolio.
                    </p>
                </div>

                {/* Investment Insights & Real Data */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Real Portfolio Weight */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-600">
                                <Wallet size={32} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Portfolio Allocation</h4>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">Gold Asset</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-yellow-600 uppercase mb-1">{portfolioWeight.toFixed(1)}% Weight</p>
                            <div className="w-40 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-yellow-600 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)] transition-all duration-1000"
                                    style={{ width: `${Math.min(100, portfolioWeight)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* PERFORMANCE METRICS */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-xl border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-8">
                            <BarChart3 size={20} className="text-yellow-600" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Market Performance</h3>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <PerfCard label="Last 24h" value={goldChanges?.d1} goldValue={goldValue} currency={currency} />
                            <PerfCard label="Last Week" value={goldChanges?.w1} goldValue={goldValue} currency={currency} />
                            <PerfCard label="Last Month" value={goldChanges?.m1} goldValue={goldValue} currency={currency} />
                            <PerfCard label="Last Year" value={goldChanges?.y1} goldValue={goldValue} currency={currency} />
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Timer size={14} className="text-gray-400" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Valuation Method</span>
                            </div>
                            <span className="text-[10px] font-black text-yellow-600 uppercase bg-yellow-500/10 px-2 py-1 rounded-lg">
                                Real-time XAU/USD
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PerfCard({ label, value, goldValue, currency }) {
    const isPositive = value >= 0;
    const monetaryChange = (goldValue || 0) * (value / 100);

    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-transparent hover:border-yellow-500/20 transition-all group">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 group-hover:text-gray-500 transition-colors">{label}</p>
            <div className="flex flex-col">
                <p className={`text-lg font-black ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}{value?.toFixed(2)}%
                </p>
                <p className={`text-[10px] font-bold ${isPositive ? 'text-green-600/70' : 'text-red-600/70'} mt-0.5`}>
                    {isPositive ? '+' : ''}{formatMoney(monetaryChange, currency)}
                </p>
            </div>
        </div>
    );
}
