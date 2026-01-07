import React from 'react';
import CardTable from '../components/CardTable';
import FundTable from '../components/FundTable';
import OtherTable from '../components/OtherTable';
import SummaryCards from '../components/SummaryCards';

export default function Dashboard({ data }) {
    const {
        cards, funds, others,
        addCard, updateCard, removeCard,
        addFund, updateFund, removeFund,
        addOther, updateOther, removeOther,
        totals
    } = data;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Tables Section */}
            <CardTable
                cards={cards}
                updateCard={updateCard}
                removeCard={removeCard}
            />
            <div className="text-right">
                <button onClick={addCard} className="text-sm font-semibold text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
                    + Add New Card
                </button>
            </div>

            <FundTable
                funds={funds}
                updateFund={updateFund}
                removeFund={removeFund}
            />
            <div className="text-right">
                <button onClick={addFund} className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                    + Add New Asset/Account
                </button>
            </div>

            <OtherTable
                others={others}
                updateOther={updateOther}
                removeOther={removeOther}
            />
            <div className="text-right">
                <button onClick={addOther} className="text-sm font-semibold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                    + Add New Payment
                </button>
            </div>

            {/* Summary Section */}
            <SummaryCards totals={totals} />
        </div>
    );
}
