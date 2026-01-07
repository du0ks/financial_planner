import React, { useState } from 'react';
import { LayoutDashboard, History, Settings, Table2, Banknote, Download } from 'lucide-react';

export default function Layout({ children, activeTab, onTabChange }) {
    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen p-4 md:p-8 text-gray-900 dark:text-gray-100 font-sans">
            <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden flex flex-col min-h-[85vh]">

                {/* Header */}
                <div className="bg-green-700 dark:bg-green-900 text-white p-6 flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center">
                            <Table2 className="text-green-300 mr-2" />
                            Financial Tracking
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button className="bg-green-600 dark:bg-green-800 text-white hover:bg-green-500 dark:hover:bg-green-700 px-4 py-2 rounded-lg font-bold transition shadow-md flex items-center">
                            <Banknote className="mr-2" size={18} />
                            <span>TRY ₺</span>
                        </button>
                        <button className="bg-white dark:bg-gray-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-gray-600 px-4 py-2 rounded-lg font-bold transition shadow-md flex items-center">
                            <Download className="mr-2" size={18} />
                            <span>Export</span>
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <div className="bg-green-600 dark:bg-green-800 text-green-100 flex overflow-x-auto text-sm font-medium">
                    <NavButton
                        active={activeTab === 'dashboard'}
                        onClick={() => onTabChange('dashboard')}
                        icon={<LayoutDashboard size={18} />}
                        label="Dashboard"
                    />
                    <NavButton
                        active={activeTab === 'history'}
                        onClick={() => onTabChange('history')}
                        icon={<History size={18} />}
                        label="History"
                    />
                    <NavButton
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                        icon={<Settings size={18} />}
                        label="Settings"
                    />
                </div>

                {/* Content Area */}
                <div className="p-6 flex-grow relative overflow-y-auto">
                    {children}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 text-center text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700">
                    <p>Data is automatically saved to your browser.</p>
                </div>
            </div>
        </div>
    );
}

function NavButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-3 px-4 hover:bg-green-500 dark:hover:bg-green-700 transition text-center flex justify-center items-center border-b-4 ${active ? 'border-white dark:border-green-200' : 'border-transparent opacity-80'}`}
        >
            <span className="mr-2">{icon}</span> {label}
        </button>
    )
}
