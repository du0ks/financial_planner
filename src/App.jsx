import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import HistoryView from './pages/HistoryView';
import InvestmentsView from './pages/InvestmentsView';
import SettingsView from './pages/SettingsView';
import AuthView from './pages/AuthView';
import useFinanceData from './hooks/useFinanceData';
import { supabase } from './utils/supabase';
import ThemeColorObserver from './components/ThemeColorObserver';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [session, setSession] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setAuthLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleDemoLogin = () => {
        // Clear all demo data so it starts fresh every time
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('demo_')) {
                localStorage.removeItem(key);
            }
        });

        setSession({
            user: { email: 'demo@prosperity.app', id: 'demo-user' },
            isDemo: true
        });
    };

    const financeData = useFinanceData(session);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <ThemeColorObserver />
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (!session) {
        return <AuthView onDemoLogin={handleDemoLogin} />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard data={financeData} />;
            case 'investments':
                return <InvestmentsView data={financeData} />;
            case 'history':
                return <HistoryView data={financeData} />;
            case 'settings':
                return <SettingsView data={financeData} />;
            default:
                return <Dashboard data={financeData} />;
        }
    };

    return (
        <>
            <ThemeColorObserver />
            <Layout
                activeTab={activeTab}
                onTabChange={setActiveTab}
                currency={financeData.currency}
                onToggleCurrency={financeData.toggleCurrency}
                userEmail={session.user.email}
            >
                {renderContent()}
            </Layout>
        </>
    );
}

export default App;
