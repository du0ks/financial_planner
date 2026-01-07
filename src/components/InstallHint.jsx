import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export default function InstallHint() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Detect if already installed (standalone mode)
        const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

        // Only show on iOS and if not already installed
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        // Show if it's iOS and not in standalone mode, and hasn't been dismissed this session
        const hasDismissed = sessionStorage.getItem('pwa_hint_dismissed');

        if (isIOS && !isStandalone && !hasDismissed) {
            // Delay slightly to not overwhelm immediately
            const timer = setTimeout(() => setIsVisible(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('pwa_hint_dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-[100] animate-bounce-in">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-2xl border border-green-500/20 shadow-green-500/10 relative overflow-hidden">
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X size={16} />
                </button>

                <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-2xl shrink-0">
                        <PlusSquare className="text-green-600 dark:text-green-400" size={24} />
                    </div>
                    <div className="pr-4">
                        <h4 className="font-black text-sm text-gray-900 dark:text-white mb-1 uppercase tracking-tight">Step into the App</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                            To use Prosperity as a full app, tap <Share className="inline-block mx-0.5" size={14} /> and choose <span className="font-bold text-gray-700 dark:text-gray-200">"Add to Home Screen"</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
