import React from 'react';
import { History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react';


export const SettingsView = () => (
    <div className="text-center py-20 text-gray-500 dark:text-gray-400 animate-fade-in">
        <SettingsIcon className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={64} />
        <h2 className="text-xl font-bold mb-2">App Settings</h2>
        <p>Configure currency, themes, and backup options here.</p>
        <p className="text-sm mt-4 text-green-600 dark:text-green-400">Coming soon!</p>
    </div>
);
