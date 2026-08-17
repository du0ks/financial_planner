import { Camera } from 'lucide-react';
import SummaryCards from '../components/SummaryCards';
import CardTable from '../components/CardTable';
import FundTable from '../components/FundTable';
import OtherTable from '../components/OtherTable';
import { formatMoney } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md) — Screen 1, Money (Overview).
// Income tracking (separate from Funds) is paused per your call — its section, "Add Income"
// action, and IncomeTable import are commented out below rather than deleted.
// import IncomeTable from '../components/IncomeTable';
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const TEXT_MUTED = '#bab8d8';

const DAY_MS = 24 * 60 * 60 * 1000;

function relativeSnapshotLabel(history) {
    if (!history || !history.length) return 'No snapshots saved yet';
    const days = Math.floor((Date.now() - new Date(history[0].date).getTime()) / DAY_MS);
    if (days <= 0) return 'Last saved snapshot — today';
    if (days === 1) return 'Last saved snapshot — 1 day ago';
    return `Last saved snapshot — ${days} days ago`;
}

export default function Dashboard({ data }) {
    const {
        cards, funds, others,
        // incomes, addIncome, updateIncome, removeIncome, // paused with Income tracking, see above
        currency, history,
        updateCard, removeCard,
        updateFund, removeFund, addFund,
        updateOther, removeOther, addOther,
        saveSnapshot,
        totals,
    } = data;

    return (
        <div className="flex flex-col gap-7 pb-6 md:gap-8">
            <SummaryCards totals={totals} currency={currency} history={history} />

            {/* Your cards */}
            <section className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="font-display text-[23px] font-bold text-white md:text-[28px]">Your cards</h2>
                        <p className="mt-1 text-[15px] md:text-[17px]" style={{ color: TEXT_MUTED }}>
                            What you owe, what's left of your limit — edit any number right here.
                        </p>
                    </div>
                    <div className="md:text-right">
                        <p className="font-mono text-[12px] uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                            Total owed on cards
                        </p>
                        <span className="font-mono text-[24px] font-semibold md:text-[28px]" style={{ color: MAGENTA }}>
                            {formatMoney(totals.totalCardDebt, currency)}
                        </span>
                    </div>
                </div>
                <CardTable cards={cards} updateCard={updateCard} removeCard={removeCard} currency={currency} />
            </section>

            {/* Cash & Income | Bills every month */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FundTable
                    funds={funds}
                    updateFund={updateFund}
                    removeFund={removeFund}
                    addFund={addFund}
                    currency={currency}
                    totals={totals}
                />
                <OtherTable
                    others={others}
                    updateOther={updateOther}
                    removeOther={removeOther}
                    addOther={addOther}
                    currency={currency}
                    totals={totals}
                />
            </div>

            {/* Income tracking — paused, see note above. Restore by uncommenting this section
                plus the IncomeTable import and the incomes/addIncome/... destructure above.
            <section>
                <IncomeTable incomes={incomes} updateIncome={updateIncome} removeIncome={removeIncome} currency={currency} />
            </section>
            */}

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch gap-4 md:flex-row md:items-center md:justify-between">
                <span className="font-mono text-[13px] uppercase tracking-[0.16em] md:text-[14px]" style={{ color: '#a6a4c4' }}>
                    {relativeSnapshotLabel(history)}
                </span>
                <SaveButton onClick={saveSnapshot} />
            </div>
        </div>
    );
}

function SaveButton({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex h-14 items-center justify-center gap-2 font-mono text-[15px] font-semibold uppercase tracking-[0.1em] transition-colors md:h-[52px] md:w-fit md:px-6"
            style={{ backgroundColor: CYAN, color: '#050409' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = MAGENTA; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = CYAN; }}
        >
            <Camera size={17} />
            Save today's numbers
        </button>
    );
}
