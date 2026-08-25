import { useState, useEffect, useRef } from 'react';
import { CreditCard, X } from 'lucide-react';
import { parseCloudNumber, CURRENCY_SYMBOLS } from '../utils/format';

// Neon Grid design tokens, matched to CardTable.jsx so a card created here looks
// exactly like the panel it will become on the Money screen.
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const TEXT_MUTED = '#bab8d8';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';
const FIELD_BG = '#060410';

const CURRENCIES = ['TRY', 'UAH', 'EUR', 'USD'];

/**
 * Modal for creating a card with real values, replacing the old "silently append a
 * blank template" behaviour of Settings' Add-a-card button.
 *
 * Only the three editable fields from a card panel are offered — "Left to spend" is
 * derived (limit - debt) and so has no place on a creation form.
 */
export default function AddCardDialog({ onSubmit, onClose }) {
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('TRY');
    const [limit, setLimit] = useState('');
    const [money, setMoney] = useState('');
    const [debt, setDebt] = useState('');
    const nameRef = useRef(null);

    const canSubmit = name.trim().length > 0;

    useEffect(() => { nameRef.current?.focus(); }, []);

    // Escape closes, matching the backdrop click.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            name: name.trim(),
            currency,
            limit: parseCloudNumber(limit),
            money: parseCloudNumber(money),
            debt: parseCloudNumber(debt),
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4"
            style={{ backgroundColor: 'rgba(3,2,10,0.78)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-card-title"
                onSubmit={handleSubmit}
                className="w-full border sm:max-w-[520px]"
                style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}
            >
                {/* Header mirrors a card panel's header row: icon square, name input, accent. */}
                <div
                    className="flex items-center gap-3 border-b px-4 py-[13px]"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                >
                    <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center border"
                        style={{ borderColor: MAGENTA, backgroundColor: `${MAGENTA}1a` }}
                    >
                        <CreditCard size={16} style={{ color: MAGENTA }} />
                    </div>
                    <h2
                        id="add-card-title"
                        className="flex-1 font-display text-[18px] font-semibold text-white md:text-[20px]"
                    >
                        Add a card
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                    >
                        <X size={15} style={{ color: '#a6a4c4' }} />
                    </button>
                </div>

                <div className="px-4 py-4">
                    {/* Name + currency, laid out like the panel header they mimic. */}
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
                        <label className="flex min-w-0 flex-1 basis-full flex-col gap-1 sm:basis-0">
                            <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>
                                Name
                            </span>
                            <input
                                ref={nameRef}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Card name"
                                required
                                className="min-w-0 border-b border-dashed bg-transparent pb-1 font-display text-[18px] font-semibold text-white outline-none md:text-[20px]"
                                style={{ borderColor: 'rgba(255,255,255,0.22)' }}
                            />
                        </label>
                        <label className="flex shrink-0 flex-col gap-1">
                            <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>
                                Currency
                            </span>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="h-7 shrink-0 border bg-transparent px-[6px] font-mono text-[12px] font-semibold uppercase tracking-[0.08em] outline-none transition-colors"
                                style={{ borderColor: 'rgba(255,255,255,0.22)', color: '#d8d6f0', backgroundColor: FIELD_BG }}
                            >
                                {CURRENCIES.map((code) => (
                                    <option key={code} value={code} style={{ backgroundColor: PANEL_BG, color: '#ffffff' }}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {/* The three editable card fields, same order and colours as the panel. */}
                    <div className="mt-4 grid grid-cols-2 gap-[10px] md:grid-cols-3">
                        <NumericField
                            label="Limit"
                            value={limit}
                            onChange={setLimit}
                            symbol={CURRENCY_SYMBOLS[currency]}
                            textColor="#ffffff"
                        />
                        <NumericField
                            label="In account"
                            value={money}
                            onChange={setMoney}
                            symbol={CURRENCY_SYMBOLS[currency]}
                            textColor={CYAN}
                        />
                        <NumericField
                            label="Debt now"
                            value={debt}
                            onChange={setDebt}
                            symbol={CURRENCY_SYMBOLS[currency]}
                            textColor={MAGENTA}
                            borderColor="rgba(255,95,180,0.45)"
                            bold
                        />
                    </div>

                    <p className="mt-3 font-mono text-[12px]" style={{ color: TEXT_MUTED }}>
                        Leave an amount blank to start it at zero.
                    </p>
                </div>

                <div
                    className="flex flex-col-reverse gap-[10px] border-t px-4 py-4 sm:flex-row sm:justify-end"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-11 border px-5 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.22)', color: '#d8d6f0' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="h-11 border px-5 font-mono text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors"
                        style={{
                            borderColor: canSubmit ? MAGENTA : 'rgba(255,255,255,0.18)',
                            backgroundColor: canSubmit ? `${MAGENTA}1f` : 'transparent',
                            color: canSubmit ? MAGENTA : '#6f6d8a',
                            cursor: canSubmit ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Add card
                    </button>
                </div>
            </form>
        </div>
    );
}

// Mirrors CardTable's CardField, minus the read-only branch and the commit-on-blur
// dance — a creation form holds its own draft state until submit.
function NumericField({ label, value, onChange, symbol, textColor, borderColor, bold }) {
    const border = borderColor || 'rgba(255,255,255,0.22)';

    return (
        <label className="flex flex-col gap-1">
            <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{label}</span>
            <div className="flex h-12 items-stretch border md:h-[42px]" style={{ borderColor: border, backgroundColor: FIELD_BG }}>
                {symbol && (
                    <span
                        className="flex items-center border-r px-[6px] font-mono text-[14px]"
                        style={{ borderColor: border, color: TEXT_MUTED }}
                    >
                        {symbol}
                    </span>
                )}
                <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="0"
                    className="w-full flex-1 bg-transparent px-2 text-right font-mono text-[17px] outline-none"
                    style={{ color: textColor, fontWeight: bold ? 600 : 400 }}
                />
            </div>
        </label>
    );
}
