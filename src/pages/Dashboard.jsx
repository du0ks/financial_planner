import React from 'react';
import CardTable from '../components/CardTable';
import FundTable from '../components/FundTable';
import OtherTable from '../components/OtherTable';
import SummaryCards from '../components/SummaryCards';
import { Plus } from 'lucide-react';

export default function Dashboard({ data }) {
    const {
        cards, funds, others,
        addCard, updateCard, removeCard,
        addFund, updateFund, removeFund,
        addOther, updateOther, removeOther,
        totals
    } = data;

    return (
        <div className="animate-fade-in pb-20">

            {/* Overview Cards */}
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 opacity-50">Financial Overview</h3>
            <SummaryCards totals={totals} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* Credit Cards & Debts */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 opacity-50">Liabilities & Credit</h3>
                        <button
                            onClick={addCard}
                            className="flex items-center text-sm font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-colors dark:bg-purple-900/20 dark:text-purple-300"
                        >
                            <Plus size={16} className="mr-1" /> Add Card
                        </button>
                    </div>
                    <CardTable
                        cards={cards}
                        updateCard={updateCard}
                        removeCard={removeCard}
                    />
                </section>

                {/* Assets & Others */}
                <section className="space-y-8">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 opacity-50">Liquid Assets</h3>
                            <button
                                onClick={addFund}
                                className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors dark:bg-blue-900/20 dark:text-blue-300"
                            >
                                <Plus size={16} className="mr-1" /> Add Asset
                            </button>
                        </div>
                        <FundTable
                            funds={funds}
                            updateFund={updateFund}
                            removeFund={removeFund}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 opacity-50">Recurring Expenses</h3>
                            <button
                                onClick={addOther}
                                className="flex items-center text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors dark:bg-red-900/20 dark:text-red-300"
                            >
                                <Plus size={16} className="mr-1" /> Add Expense
                            </button>
                        </div>
                        <OtherTable
                            others={others}
                            updateOther={updateOther}
                            removeOther={removeOther}
                        />
                    </div>
                </section>
            </div>
        </div>
    );
}
