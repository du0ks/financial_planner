import { Repeat, Info } from 'lucide-react';
import { formatMoney, parseCloudNumber, CURRENCY_SYMBOLS } from '../utils/format';
import { AmountField, RemoveButton, DashedAddButton } from './FundTable';

// Neon Grid design tokens (design_handoff_neon_grid/README.md). Shares its row/footer
// primitives with FundTable.jsx — same panel shape, magenta accent instead of cyan.
const MAGENTA = '#ff5fb4';
const TEXT_MUTED = '#bab8d8';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';
const ROW_DIVIDER = 'rgba(255,255,255,0.09)';

export default function OtherTable({ others, updateOther, removeOther, addOther, currency, totals }) {
    // Spec: "Both are set to zero" is literal demo copy for the default 2-bill data — generalized
    // here so it reads correctly regardless of how many bills exist.
    const allZero = others.length > 0 && others.every((item) => (parseFloat(item.amount) || 0) === 0);

    return (
        <div className="flex flex-col border" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div className="flex items-start justify-between gap-4 px-5 py-5 md:px-6">
                <div>
                    <h3 className="font-display text-[20px] font-semibold text-white md:text-[22px]">Bills every month</h3>
                    <p className="mt-1 text-[15px]" style={{ color: TEXT_MUTED }}>
                        Rent, tuition, subscriptions — counted against your net worth.
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>Per month</p>
                    <span className="font-mono text-[20px] font-semibold md:text-[22px]" style={{ color: MAGENTA }}>
                        {formatMoney(totals.monthlyBurn, currency)}
                    </span>
                </div>
            </div>

            <div>
                {others.map((item) => (
                    <BillRow key={item.id} item={item} updateOther={updateOther} removeOther={removeOther} currency={currency} />
                ))}
            </div>

            {allZero && (
                <div className="flex items-start gap-2 px-5 pb-4 pt-1 text-[14px] md:px-6" style={{ color: '#ff9ed0' }}>
                    <Info size={18} className="mt-0.5 shrink-0" />
                    Everything here is set to zero — put your real amounts in so the totals mean something.
                </div>
            )}

            <div className="hidden px-5 pb-5 pt-1 md:block md:px-6 md:pb-6">
                <DashedAddButton label="Add a bill" onClick={addOther} accent={MAGENTA} />
            </div>
        </div>
    );
}

function BillRow({ item, updateOther, removeOther, currency }) {
    const billCurrency = item.currency || currency;
    return (
        <div
            className="flex items-center gap-3 border-t px-5 py-[18px] md:gap-4 md:px-6"
            style={{ borderColor: ROW_DIVIDER }}
        >
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center border"
                style={{ borderColor: MAGENTA, backgroundColor: 'rgba(255,95,180,0.1)' }}
            >
                <Repeat size={18} style={{ color: MAGENTA }} />
            </div>
            <input
                type="text"
                value={item.name}
                onChange={(e) => updateOther(item.id, 'name', e.target.value)}
                placeholder="Bill name"
                className="min-w-0 flex-1 bg-transparent font-display text-[19px] font-medium text-white outline-none md:text-[21px]"
            />
            <AmountField
                value={item.amount}
                symbol={CURRENCY_SYMBOLS[billCurrency]}
                color={MAGENTA}
                onCommit={(v) => updateOther(item.id, 'amount', parseCloudNumber(v))}
            />
            <RemoveButton onClick={() => removeOther(item.id)} accent={MAGENTA} />
        </div>
    );
}
