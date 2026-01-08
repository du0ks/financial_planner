import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from '../utils/supabase';
import {
    CreditCard, Building2, RefreshCw, Link2, PieChart, TrendingUp,
    Calendar, DollarSign, ShoppingCart, Coffee, Car, Home, Wifi, Film,
    Utensils, Plane, Heart, MoreHorizontal, AlertCircle, Loader2
} from 'lucide-react';

// Category icon mapping
const categoryIcons = {
    'Food and Drink': Utensils,
    'Travel': Plane,
    'Transportation': Car,
    'Transfer': RefreshCw,
    'Payment': DollarSign,
    'Shops': ShoppingCart,
    'Recreation': Film,
    'Service': Wifi,
    'Community': Heart,
    'Healthcare': Heart,
    'Bank Fees': Building2,
};

const getCategoryIcon = (category) => {
    if (!category || !category[0]) return MoreHorizontal;
    const mainCategory = category[0];
    return categoryIcons[mainCategory] || MoreHorizontal;
};

const getCategoryColor = (category) => {
    if (!category || !category[0]) return 'bg-gray-500';
    const colors = {
        'Food and Drink': 'bg-orange-500',
        'Travel': 'bg-blue-500',
        'Transportation': 'bg-purple-500',
        'Transfer': 'bg-gray-500',
        'Payment': 'bg-green-500',
        'Shops': 'bg-pink-500',
        'Recreation': 'bg-red-500',
        'Service': 'bg-cyan-500',
        'Community': 'bg-yellow-500',
        'Healthcare': 'bg-rose-500',
        'Bank Fees': 'bg-slate-500',
    };
    return colors[category[0]] || 'bg-gray-500';
};

export default function ExpensesView({ session }) {
    const [linkToken, setLinkToken] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const userId = session?.user?.id;
    const isDemo = session?.isDemo;

    // Debug log
    console.log('ExpensesView session:', { userId, isDemo, session });

    // Fetch link token for Plaid
    const fetchLinkToken = useCallback(async () => {
        if (!userId || isDemo) {
            console.log('Skipping fetchLinkToken:', { userId, isDemo });
            return;
        }

        try {
            console.log('Fetching link token for user:', userId);
            const { data, error } = await supabase.functions.invoke('plaid-link-token', {
                body: { user_id: userId }
            });
            console.log('Link token response:', { data, error });
            if (error) throw error;
            if (data?.error) {
                setError(data.error);
                return;
            }
            setLinkToken(data.link_token);
        } catch (err) {
            console.error('Failed to get link token:', err);
            setError('Failed to connect: ' + (err.message || 'Unknown error'));
        }
    }, [userId, isDemo]);

    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        if (!userId || isDemo) return;

        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.functions.invoke('plaid-get-transactions', {
                body: { user_id: userId }
            });
            if (error) throw error;
            if (data?.error) {
                setError(data.error);
                return;
            }
            setTransactions(data?.transactions || []);
            setAccounts(data?.accounts || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId, isDemo]);

    useEffect(() => {
        fetchLinkToken();
        fetchTransactions();
    }, [fetchLinkToken, fetchTransactions]);

    // Handle Plaid Link success
    const onSuccess = useCallback(async (publicToken, metadata) => {
        try {
            setLoading(true);
            const { error } = await supabase.functions.invoke('plaid-exchange-token', {
                body: {
                    public_token: publicToken,
                    user_id: userId,
                    institution_name: metadata.institution?.name || 'Unknown Bank'
                }
            });
            if (error) throw error;
            // Refresh transactions after linking
            await fetchTransactions();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId, fetchTransactions]);

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess,
    });

    // Calculate spending summary
    const totalSpent = transactions.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);
    const categoryTotals = transactions.reduce((acc, tx) => {
        const cat = tx.category?.[0] || 'Other';
        if (tx.amount > 0) {
            acc[cat] = (acc[cat] || 0) + tx.amount;
        }
        return acc;
    }, {});
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const dailyAverage = transactions.length > 0 ? totalSpent / 30 : 0;

    // Demo mode view
    if (isDemo) {
        return (
            <div className="space-y-6">
                <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <AlertCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Bank Connection Unavailable in Demo
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Create an account to connect your bank and see your real expenses,
                        spending insights, and AI-powered financial advice.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Expenses</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {accounts.length > 0 ? `${accounts.length} account(s) connected` : 'Connect your bank to get started'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {accounts.length > 0 && (
                        <button
                            onClick={fetchTransactions}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium text-sm transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    )}
                    <button
                        onClick={() => open()}
                        disabled={!ready || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Link2 className="w-4 h-4" />
                        Connect Bank
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Linked Accounts */}
            {accounts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {accounts.map((acc) => (
                        <div key={acc.item_id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{acc.institution_name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Summary Cards */}
            {transactions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard
                        icon={DollarSign}
                        label="Total Spent (30d)"
                        value={`$${totalSpent.toFixed(2)}`}
                        color="green"
                    />
                    <SummaryCard
                        icon={PieChart}
                        label="Top Category"
                        value={topCategory ? topCategory[0] : '-'}
                        subValue={topCategory ? `$${topCategory[1].toFixed(2)}` : ''}
                        color="purple"
                    />
                    <SummaryCard
                        icon={Calendar}
                        label="Daily Average"
                        value={`$${dailyAverage.toFixed(2)}`}
                        color="blue"
                    />
                </div>
            )}

            {/* Category Breakdown */}
            {Object.keys(categoryTotals).length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Spending by Category</h3>
                    <div className="space-y-3">
                        {Object.entries(categoryTotals)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map(([cat, amount]) => {
                                const percentage = (amount / totalSpent) * 100;
                                return (
                                    <div key={cat} className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-lg ${getCategoryColor([cat])} flex items-center justify-center`}>
                                            {React.createElement(getCategoryIcon([cat]), { className: 'w-4 h-4 text-white' })}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat}</span>
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">${amount.toFixed(2)}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${getCategoryColor([cat])} rounded-full transition-all duration-500`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Transaction List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                </div>
            ) : transactions.length > 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest p-6 pb-4">Recent Transactions</h3>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {transactions.slice(0, 20).map((tx) => {
                            const IconComponent = getCategoryIcon(tx.category);
                            return (
                                <div key={tx.transaction_id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <div className={`w-10 h-10 rounded-xl ${getCategoryColor(tx.category)} flex items-center justify-center`}>
                                        <IconComponent className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{tx.name}</p>
                                        <p className="text-xs text-gray-500">{tx.date} • {tx.category?.[0] || 'Uncategorized'}</p>
                                    </div>
                                    <div className={`font-bold ${tx.amount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : accounts.length === 0 ? (
                <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <CreditCard className="w-8 h-8 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No Bank Connected
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                        Connect your bank account to automatically track your expenses and get spending insights.
                    </p>
                    <button
                        onClick={() => open()}
                        disabled={!ready}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Link2 className="w-5 h-5" />
                        Connect Your Bank
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, subValue, color }) {
    const colors = {
        green: 'bg-green-500/10 text-green-600 dark:text-green-400',
        purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
        blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    };
    return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800">
            <div className={`inline-flex p-2 rounded-xl ${colors[color]} mb-3`}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
            {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
        </div>
    );
}
