import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import { HistoryView, SettingsView } from './pages/Placeholders';
import useFinanceData from './hooks/useFinanceData';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const financeData = useFinanceData();

    const renderContent = () => {
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
        <Layout activeTab={activeTab} onTabChange={setActiveTab}>
            {renderContent()}
        </Layout>
    );
}

export default App;
