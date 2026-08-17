import { useState, useEffect } from 'react';
import { CreditCard, Trash2 } from 'lucide-react';
import { formatMoney, parseCloudNumber, CURRENCY_SYMBOLS } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md).
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const TEXT_MUTED = '#bab8d8';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';
const FIELD_BG = '#060410';
const TRACK_BG = '#16112a';

// Note: the pre-existing "Details" disclosure (interest rate, statement day, due date,
// per-card native currency) is dropped here — it's itself unshipped local WIP (confirmed via
// git diff), and the redesigned panel spec is exhaustive about its contents ("no footer").
// The underlying card fields are untouched in useFinanceData.js if this needs restoring.

export default function CardTable({ cards, updateCard, removeCard, currency }) {
    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {cards.map((card) => (
                <CardPanel key={card.id} card={card} updateCard={updateCard} removeCard={removeCard} currency={currency} />
            ))}
        </div>
    );
}

function CardPanel({ card, updateCard, removeCard, currency }) {
    const limit = parseFloat(card.limit) || 0;
    const debt = parseFloat(card.debt) || 0;
    const money = parseFloat(card.money) || 0;
    const available = limit - debt;
    const cardNet = money - debt;
    const cardCurrency = card.currency || currency;
    const hasDebt = debt > 0;
    const accent = hasDebt ? MAGENTA : CYAN;
    const usedPct = limit > 0 ? Math.min(100, Math.max(0, (debt / limit) * 100)) : 0;

    return (
        <div className="border" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            {/* Header row */}
            <div
                className="flex items-center justify-between gap-3 border-b px-4 py-[13px]"
                style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center border"
                        style={{ borderColor: accent, backgroundColor: `${accent}1a` }}
                    >
                        <CreditCard size={16} style={{ color: accent }} />
                    </div>
                    <input
                        type="text"
                        value={card.name}
                        onChange={(e) => updateCard(card.id, 'name', e.target.value)}
                        placeholder="Card name"
                        className="min-w-0 flex-1 border-b border-dashed bg-transparent font-display text-[18px] font-semibold text-white outline-none md:text-[20px]"
                        style={{ borderColor: 'rgba(255,255,255,0.22)' }}
                    />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[17px] font-bold md:text-[19px]" style={{ color: accent }}>
                        {cardNet > 0 ? '+' : ''}{formatMoney(cardNet, cardCurrency)}
                    </span>
                    <RemoveButton onClick={() => removeCard(card.id)} />
                </div>
            </div>

            {/* Limit used */}
            <div className="px-4 pt-[13px]">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[12px] uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                        Limit used
                    </span>
                    <span className="font-mono text-[14px] text-white">
                        {hasDebt ? `${formatMoney(debt, cardCurrency)} of ${formatMoney(limit, cardCurrency)}` : 'Nothing used'}
                    </span>
                </div>
                <div className="mt-2 h-2 w-full border" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: TRACK_BG }}>
                    <div
                        className="h-full transition-[width] duration-500"
                        style={{
                            width: `${usedPct}%`,
                            backgroundImage: hasDebt
                                ? 'repeating-linear-gradient(135deg, #ff5fb4 0 6px, #c93b8b 6px 12px)'
                                : 'none',
                        }}
                    />
                </div>
            </div>

            {/* Four fields */}
            <div className="grid grid-cols-2 gap-[10px] px-4 pb-4 pt-[14px] md:grid-cols-4">
                <CardField
                    label="Limit"
                    value={card.limit}
                    symbol={CURRENCY_SYMBOLS[cardCurrency]}
                    textColor="#ffffff"
                    onCommit={(v) => updateCard(card.id, 'limit', parseCloudNumber(v))}
                />
                <CardField
                    label="In account"
                    value={card.money}
                    symbol={CURRENCY_SYMBOLS[cardCurrency]}
                    textColor={CYAN}
                    onCommit={(v) => updateCard(card.id, 'money', parseCloudNumber(v))}
                />
                <CardField
                    label="Debt now"
                    value={card.debt}
                    symbol={CURRENCY_SYMBOLS[cardCurrency]}
                    textColor={MAGENTA}
                    borderColor="rgba(255,95,180,0.45)"
                    bold
                    onCommit={(v) => updateCard(card.id, 'debt', parseCloudNumber(v))}
                />
                <CardField
                    label="Left to spend"
                    displayValue={formatMoney(available, cardCurrency)}
                    readOnly
                    textColor={CYAN}
                    borderColor="rgba(126,233,255,0.3)"
                    bgColor="rgba(126,233,255,0.07)"
                />
            </div>
        </div>
    );
}

function CardField({ label, value, displayValue, symbol, onCommit, textColor, borderColor, bgColor, readOnly, bold }) {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);

    const border = borderColor || 'rgba(255,255,255,0.22)';

    return (
        <label className="flex flex-col gap-1">
            <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{label}</span>
            <div
                className="flex h-12 items-stretch border md:h-[42px]"
                style={{ borderColor: border, backgroundColor: bgColor || FIELD_BG }}
            >
                {symbol && (
                    <span
                        className="flex items-center border-r px-[6px] font-mono text-[14px]"
                        style={{ borderColor: border, color: TEXT_MUTED }}
                    >
                        {symbol}
                    </span>
                )}
                {readOnly ? (
                    <span className="flex flex-1 items-center justify-end px-2 font-mono text-[17px]" style={{ color: textColor }}>
                        {displayValue}
                    </span>
                ) : (
                    <input
                        type="text"
                        inputMode="decimal"
                        value={local}
                        onChange={(e) => setLocal(e.target.value)}
                        onBlur={() => onCommit(local)}
                        className="w-full flex-1 bg-transparent px-2 text-right font-mono text-[17px] outline-none"
                        style={{ color: textColor, fontWeight: bold ? 600 : 400 }}
                    />
                )}
            </div>
        </label>
    );
}

function RemoveButton({ onClick }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border transition-colors"
            style={{ borderColor: hover ? MAGENTA : 'rgba(255,255,255,0.18)' }}
        >
            <Trash2 size={15} style={{ color: hover ? MAGENTA : '#a6a4c4' }} />
        </button>
    );
}
