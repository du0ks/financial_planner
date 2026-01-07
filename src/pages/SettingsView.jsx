import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Upload, Shield, Database, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsView({ data }) {
    const { exportBackup, importBackup } = data;
    const [isRestoring, setIsRestoring] = useState(false);
    const [showStatus, setShowStatus] = useState(null);

    const handleFileImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = importBackup(e.target.result);
            setShowStatus(success ? 'success' : 'error');
            setIsRestoring(false);
            setTimeout(() => setShowStatus(null), 3000);
        };
        reader.onerror = () => {
            setShowStatus('error');
            setIsRestoring(false);
        };
        reader.readAsText(file);
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-20">
            <header className="mb-10 text-center">
                <div className="inline-flex p-4 bg-green-500/10 rounded-full mb-4">
                    <SettingsIcon className="text-green-500" size={32} />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">App Settings</h2>
                <p className="text-gray-500 dark:text-gray-400">Control your data and preferences</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Data Management & Backups */}
                <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Database className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Backups</h3>
                            <p className="text-xs text-gray-500">Manual export and recovery</p>
                        </div>
                    </div>

                    <div className="space-y-4 flex-grow">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Export Data</p>
                            <button
                                onClick={exportBackup}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-transparent hover:border-blue-500/20 hover:bg-white dark:hover:bg-gray-800 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <Save className="text-blue-500" size={18} />
                                    <span className="font-bold text-sm">Download .JSON Backup</span>
                                </div>
                                <ChevronDown size={16} className="text-gray-300 -rotate-90" />
                            </button>
                        </div>

                        <div className="pt-4 border-t border-gray-50 dark:border-gray-800/50">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Restore Data</p>
                            <label className="cursor-pointer block">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileImport}
                                    className="hidden"
                                />
                                <div className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 border-dashed transition-all ${isRestoring ? 'border-amber-500 bg-amber-500/5 animate-pulse' : 'border-gray-200 dark:border-gray-700 hover:border-amber-500/50 bg-gray-50 dark:bg-gray-800/50'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <Upload className="text-amber-500" size={18} />
                                        <span className="font-bold text-sm">{isRestoring ? 'Restoring...' : 'Upload JSON File'}</span>
                                    </div>
                                    {showStatus === 'success' && <CheckCircle2 size={18} className="text-green-500" />}
                                    {showStatus === 'error' && <AlertCircle size={18} className="text-red-500" />}
                                </div>
                            </label>
                        </div>
                    </div>

                    <p className="text-[10px] text-gray-400 mt-8 leading-relaxed italic text-center uppercase tracking-tighter">
                        Restoring a backup will overwrite your current data.
                    </p>
                </div>

                {/* Security Card */}
                <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-500/10 rounded-xl">
                            <Shield className="text-purple-500" size={20} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Security & Sync</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 font-medium">
                            <p className="text-center text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
                                Your data is end-to-end synced with your secure Supabase account.
                                Manual backups provide an extra layer of local safety.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Live Cloud Sync Active
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
