import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import { HistoryView, SettingsView } from './pages/Placeholders';
import useFinanceData from './hooks/useFinanceData';

function App() {
    console.log("App.jsx: Rendering started");
    const [activeTab, setActiveTab] = useState('dashboard');

    let financeData;
    try {
        financeData = useFinanceData();
        console.log("App.jsx: Hooks loaded successfully");
    } catch (e) {
        console.error("App.jsx: Error in useFinanceData hook", e);
        throw e;
    }

    const renderContent = () => {
        console.log("App.jsx: Rendering content for tab:", activeTab);
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard data={financeData} />;
            case 'history':
                return <HistoryView />;
            case 'settings':
                return <SettingsView />;
            default:
                return <Dashboard data={financeData} />;
        }
    };

    return (
        <Layout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currency={financeData.currency}
            onToggleCurrency={financeData.toggleCurrency}
        >
            {renderContent()}
        </Layout>
    );
}

export default App;
