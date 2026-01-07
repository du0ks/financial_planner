import React from 'react';
import { Wallet, Banknote } from 'lucide-react';

export default function Layout({ children, activeTab, onTabChange, currency, onToggleCurrency }) {
    return (
        <div className="font-sans text-gray-900 dark:text-gray-100 min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black transition-colors duration-500">

            {/* Mobile-First Header */}
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-tr from-green-500 to-emerald-400 p-2 rounded-xl shadow-lg shadow-green-500/20">
                            <Wallet className="text-white w-6 h-6" />
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                            Prosperity
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleCurrency}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition font-mono font-bold text-sm text-green-600 dark:text-green-400 border border-transparent active:scale-95"
                        >
                            <Banknote className="w-4 h-4" />
                            <span>{currency}</span>
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto gap-6 text-sm font-medium no-scrollbar">
                    <NavTab
                        active={activeTab === 'dashboard'}
                        onClick={() => onTabChange('dashboard')}
                        label="Overview"
                    />
                    <NavTab
                        active={activeTab === 'history'}
                        onClick={() => onTabChange('history')}
                        label="History"
                    />
                    <NavTab
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                        label="Settings"
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
                {children}
            </main>

        </div>
    );
}

function NavTab({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`py-3 border-b-2 transition-all duration-300 whitespace-nowrap ${active
                ? 'border-green-500 text-green-600 dark:text-green-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
        >
            {label}
        </button>
    )
}
