import { useState, useEffect } from 'react';
import { Trash2, Landmark, PiggyBank, Banknote, Plus } from 'lucide-react';
import { formatMoney, parseCloudNumber, CURRENCY_SYMBOLS } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md). This panel is now fully
// self-contained (header + rows + footer) — Dashboard.jsx just places it in a 2-col grid
// next to OtherTable's "Bills every month" panel.
const CYAN = '#7ee9ff';
const TEXT_MUTED = '#bab8d8';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';
const ROW_DIVIDER = 'rgba(255,255,255,0.09)';

// The three icons the spec lists (Landmark/PiggyBank/Banknote) map to the three default
// fund names (Salary Account/Savings Account/Wallet-Cash) — picking by keyword generalizes
// that pattern to renamed or added accounts. A real component (not a helper that resolves
// and returns a component reference) so react-hooks/static-components doesn't flag it.
function FundIcon({ name = '' }) {
    const n = name.toLowerCase();
    if (n.includes('wallet') || n.includes('cash')) return <Banknote size={18} style={{ color: CYAN }} />;
    if (n.includes('saving')) return <PiggyBank size={18} style={{ color: CYAN }} />;
    return <Landmark size={18} style={{ color: CYAN }} />;
}

export default function FundTable({ funds, updateFund, removeFund, addFund, currency, totals }) {
    return (
        <div className="flex flex-col border" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div className="flex items-start justify-between gap-4 px-5 py-5 md:px-6">
                <div>
                    <h3 className="font-display text-[20px] font-semibold text-white md:text-[22px]">Cash &amp; Income</h3>
                    <p className="mt-1 text-[15px]" style={{ color: TEXT_MUTED }}>
                        Bank balances, cash in hand, money on its way in.
                    </p>
                </div>
                <span className="shrink-0 font-mono text-[20px] font-semibold md:text-[22px]" style={{ color: CYAN }}>
                    {formatMoney(totals.totalAssets, currency)}
                </span>
            </div>

            <div>
                {funds.map((fund) => (
                    <FundRow key={fund.id} fund={fund} updateFund={updateFund} removeFund={removeFund} currency={currency} />
                ))}
            </div>

            {/* Per README's Mobile Money note ("Add a card/account/bill is not on this screen"),
                this footer add-button is desktop-only; mobile funnels adding through Settings. */}
            <div className="hidden px-5 pb-5 pt-1 md:block md:px-6 md:pb-6">
                <DashedAddButton label="Add an account" onClick={addFund} accent={CYAN} />
            </div>
        </div>
    );
}

function FundRow({ fund, updateFund, removeFund, currency }) {
    return (
        <div
            className="flex items-center gap-3 border-t px-5 py-[18px] md:gap-4 md:px-6"
            style={{ borderColor: ROW_DIVIDER }}
        >
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center border"
                style={{ borderColor: CYAN, backgroundColor: 'rgba(126,233,255,0.1)' }}
            >
                <FundIcon name={fund.name} />
            </div>
            <input
                type="text"
                value={fund.name}
                onChange={(e) => updateFund(fund.id, 'name', e.target.value)}
                placeholder="Account name"
                className="min-w-0 flex-1 bg-transparent font-display text-[19px] font-medium text-white outline-none md:text-[21px]"
            />
            <AmountField
                value={fund.amount}
                symbol={CURRENCY_SYMBOLS[currency]}
                onCommit={(v) => updateFund(fund.id, 'amount', parseCloudNumber(v))}
            />
            <RemoveButton onClick={() => removeFund(fund.id)} />
        </div>
    );
}

export function AmountField({ value, symbol, onCommit, color = '#ffffff' }) {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);

    return (
        <div className="flex h-12 w-[110px] shrink-0 items-center gap-1 md:h-12 md:w-[118px]">
            <span className="font-mono text-[15px] opacity-60 md:text-[21px]" style={{ color }}>{symbol}</span>
            <input
                type="text"
                inputMode="decimal"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={() => onCommit(local)}
                className="w-full min-w-0 bg-transparent text-right font-mono text-[16px] font-medium outline-none md:text-[21px]"
                style={{ color }}
            />
        </div>
    );
}

export function RemoveButton({ onClick, accent = '#ff5fb4' }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="hidden h-12 w-12 shrink-0 items-center justify-center transition-colors md:flex"
        >
            <Trash2 size={17} style={{ color: hover ? accent : '#a6a4c4' }} />
        </button>
    );
}

export function DashedAddButton({ label, onClick, accent }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="flex h-[50px] w-full items-center justify-center gap-2 border border-dashed font-mono text-[14px] font-semibold uppercase tracking-[0.16em] transition-colors"
            style={{ borderColor: accent, color: accent, backgroundColor: hover ? `${accent}12` : 'transparent' }}
        >
            <Plus size={16} />
            {label}
        </button>
    );
}
