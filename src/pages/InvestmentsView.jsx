import { useState } from 'react';
import { Coins, Scale, Radio, Plus, Minus, BarChart3, Info } from 'lucide-react';
import { formatMoney, parseCloudNumber } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md) — Screen 2, Investments (gold).
// The spec narrows this screen to gold only ("Investments (gold)" throughout, and the body
// only ever describes a gold hero + a buy/sell panel + gold performance stats). The old
// multi-asset UI (euro/USD/custom "Holdings" grid, the type dropdown, "Add Investment") is
// dropped from this screen accordingly. useFinanceData.js is untouched, so if any non-gold
// investment entries exist their value still counts toward totals — they're just no longer
// editable from this screen. Flagged in the handoff summary; easy to bring back if needed.
//
// Also: the spec's explainer copy ("Gold is not counted in the net worth on your Money page")
// doesn't match this app's actual math — totalInvestmentValue (which includes gold) already
// feeds into totalAssets/overallNet in useFinanceData.js. Rather than ship a line that's false
// about the user's own numbers, or silently change what counts toward net worth, the note
// below states the real behavior instead of the spec's literal copy. Also flagged in summary.
const AMBER = '#ffc861';
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const TEXT_MUTED = '#bab8d8';
const TEXT_DIM = '#a6a4c4';
const TEXT_BODY = '#e2e0f7';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';
const FIELD_BG = '#060410';

function formatGrams(value) {
    return `${(value || 0).toFixed(2).replace('.', ',')} grams`;
}

export default function InvestmentsView({ data }) {
    const { goldGrams, setGoldGrams, goldValue, goldPricePerGram, currency, goldChanges } = data;
    const [inputGrams, setInputGrams] = useState('');

    const handleGoldChange = (direction) => {
        const grams = parseCloudNumber(inputGrams);
        if (grams <= 0) return;
        setGoldGrams((current) => Math.max(0, current + grams * direction));
        setInputGrams('');
    };

    const pendingValue = parseCloudNumber(inputGrams) * goldPricePerGram;

    return (
        <div className="flex flex-col gap-7 pb-6 md:gap-8">
            <Hero goldValue={goldValue} goldGrams={goldGrams} goldPricePerGram={goldPricePerGram} currency={currency} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
                <AddSellPanel
                    inputGrams={inputGrams}
                    setInputGrams={setInputGrams}
                    pendingValue={pendingValue}
                    currency={currency}
                    onBuy={() => handleGoldChange(1)}
                    onSell={() => handleGoldChange(-1)}
                />
                <PerformancePanel goldChanges={goldChanges} goldValue={goldValue} currency={currency} />
            </div>

            <ExplainerNote />
        </div>
    );
}

function Hero({ goldValue, goldGrams, goldPricePerGram, currency }) {
    return (
        <section
            className="relative overflow-hidden border p-6 md:px-[34px] md:pb-[40px] md:pt-[38px]"
            style={{
                borderColor: 'rgba(255,200,97,0.30)',
                backgroundImage: 'linear-gradient(180deg, #150f06 0%, #08060e 100%)',
            }}
        >
            <GoldGridTexture />

            <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    <p
                        className="mb-4 font-mono text-[13px] font-medium uppercase tracking-[0.18em] md:text-[15px]"
                        style={{ color: TEXT_MUTED }}
                    >
                        What your gold is worth today
                    </p>
                    <div className="flex flex-wrap items-baseline gap-6">
                        <span
                            className="font-display text-[42px] font-extrabold leading-[0.9] tracking-[-0.03em] text-white md:text-[84px]"
                            style={{ textShadow: '0 0 22px rgba(255,200,97,0.35)' }}
                        >
                            {formatMoney(goldValue, currency)}
                        </span>
                        <span
                            className="inline-flex items-center gap-2 border px-[14px] py-[9px] font-mono text-[15px] font-semibold md:text-[17px]"
                            style={{ borderColor: 'rgba(255,200,97,0.5)', backgroundColor: 'rgba(255,200,97,0.1)', color: AMBER }}
                        >
                            <Scale size={16} />
                            {formatGrams(goldGrams)}
                        </span>
                    </div>
                    <p className="mt-5 max-w-[600px] text-[17px] md:text-[19px]" style={{ color: TEXT_BODY, textWrap: 'pretty' }}>
                        Kept separate from your spending money on purpose — this is the part you don't touch.
                    </p>
                </div>

                <div className="shrink-0 border px-[22px] py-5" style={{ borderColor: PANEL_BORDER, backgroundColor: 'rgba(0,0,0,0.35)' }}>
                    <p className="font-mono text-[14px]" style={{ color: TEXT_MUTED }}>Price per gram now</p>
                    <p className="mt-2 font-mono text-[26px] font-semibold md:text-[32px]" style={{ color: AMBER }}>
                        {formatMoney(goldPricePerGram, currency)}
                    </p>
                    <p className="mt-2 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em]" style={{ color: CYAN }}>
                        <Radio size={13} />
                        live · XAU/USD
                    </p>
                </div>
            </div>

            <div
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ backgroundColor: MAGENTA, boxShadow: '0 0 16px 1px rgba(255,95,180,0.45)' }}
            />
        </section>
    );
}

function GoldGridTexture() {
    const mask = 'linear-gradient(180deg, transparent 10%, #000 94%)';
    return (
        <>
            <div
                className="pointer-events-none absolute inset-0 hidden opacity-[0.42] md:block"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(255,200,97,0.18) 0 1px, transparent 1px 68px),' +
                        'repeating-linear-gradient(0deg, rgba(255,95,180,0.14) 0 1px, transparent 1px 48px)',
                    maskImage: mask,
                    WebkitMaskImage: mask,
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.42] md:hidden"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(255,200,97,0.18) 0 1px, transparent 1px 48px),' +
                        'repeating-linear-gradient(0deg, rgba(255,95,180,0.14) 0 1px, transparent 1px 40px)',
                    maskImage: mask,
                    WebkitMaskImage: mask,
                }}
            />
        </>
    );
}

function AddSellPanel({ inputGrams, setInputGrams, pendingValue, currency, onBuy, onSell }) {
    return (
        <div className="flex flex-col gap-5 border p-5 md:p-6" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div className="flex items-center gap-3">
                <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border"
                    style={{ borderColor: AMBER, backgroundColor: `${AMBER}1a` }}
                >
                    <Coins size={17} style={{ color: AMBER }} />
                </div>
                <h3 className="font-display text-[19px] font-semibold text-white md:text-[22px]">Add or sell gold</h3>
            </div>

            <label className="flex flex-col gap-2">
                <span className="font-mono text-[12px] uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>Amount</span>
                <div className="flex h-[52px] items-stretch border" style={{ borderColor: 'rgba(255,255,255,0.22)', backgroundColor: FIELD_BG }}>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={inputGrams}
                        onChange={(e) => setInputGrams(e.target.value)}
                        placeholder="0,00"
                        className="w-full min-w-0 flex-1 bg-transparent px-4 font-mono text-[19px] text-white outline-none"
                    />
                    <span
                        className="flex items-center border-l px-4 font-mono text-[15px]"
                        style={{ borderColor: 'rgba(255,255,255,0.22)', color: TEXT_MUTED }}
                    >
                        g
                    </span>
                </div>
            </label>

            <p className="text-[14px]" style={{ color: TEXT_DIM }}>
                That's about {formatMoney(pendingValue, currency)} at today's price.
            </p>

            <div className="grid grid-cols-2 gap-3 md:flex md:flex-col">
                <button
                    onClick={onBuy}
                    className="flex h-[52px] items-center justify-center gap-2 font-mono text-[14px] font-semibold uppercase tracking-[0.14em] transition-colors"
                    style={{ backgroundColor: AMBER, color: '#100b02' }}
                >
                    <Plus size={16} />
                    <span className="md:hidden">Bought</span>
                    <span className="hidden md:inline">I bought gold</span>
                </button>
                <SellButton onClick={onSell} />
            </div>

            <p className="text-[13px]" style={{ color: TEXT_DIM }}>Saved to your private cloud right away.</p>
        </div>
    );
}

function SellButton({ onClick }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="flex h-[52px] items-center justify-center gap-2 border font-mono text-[14px] font-semibold uppercase tracking-[0.14em] transition-colors"
            style={{ borderColor: hover ? MAGENTA : 'rgba(255,255,255,0.22)', color: hover ? MAGENTA : '#d8d6f0' }}
        >
            <Minus size={16} />
            <span className="md:hidden">Sold</span>
            <span className="hidden md:inline">I sold or used gold</span>
        </button>
    );
}

function PerformancePanel({ goldChanges, goldValue, currency }) {
    const changes = goldChanges || {};
    return (
        <div className="flex flex-col gap-5 border p-5 md:p-6" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div>
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border"
                        style={{ borderColor: AMBER, backgroundColor: `${AMBER}1a` }}
                    >
                        <BarChart3 size={17} style={{ color: AMBER }} />
                    </div>
                    <h3 className="font-display text-[19px] font-semibold text-white md:text-[22px]">How gold moved</h3>
                </div>
                <p className="mt-2 text-[15px]" style={{ color: TEXT_MUTED }}>
                    and what it did to your {formatMoney(goldValue, currency)}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-[14px] md:grid-cols-4">
                <PerfCell label="Last 24h" pct={changes.d1} goldValue={goldValue} currency={currency} />
                <PerfCell label="Last week" pct={changes.w1} goldValue={goldValue} currency={currency} />
                <PerfCell label="Last month" pct={changes.m1} goldValue={goldValue} currency={currency} />
                <PerfCell label="Last year" pct={changes.y1} goldValue={goldValue} currency={currency} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                <p className="text-[13px]" style={{ color: TEXT_DIM }}>
                    Priced from the live world gold rate, converted to lira.
                </p>
                <span
                    className="border px-3 py-1 font-mono text-[12px] uppercase tracking-[0.12em]"
                    style={{ borderColor: AMBER, color: AMBER }}
                >
                    XAU/USD
                </span>
            </div>
        </div>
    );
}

function PerfCell({ label, pct = 0, goldValue, currency }) {
    const value = pct || 0;
    const positive = value >= 0;
    const color = positive ? CYAN : MAGENTA;
    const money = (goldValue || 0) * (value / 100);
    return (
        <div className="border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: FIELD_BG }}>
            <p className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{label}</p>
            <p className="mt-2 font-mono text-[22px] font-semibold md:text-[26px]" style={{ color }}>
                {positive ? '+' : ''}{value.toFixed(2)}%
            </p>
            <p className="mt-1 font-mono text-[14px] md:text-[15px]" style={{ color }}>
                {positive ? '+' : ''}{formatMoney(money, currency)}
            </p>
        </div>
    );
}

function ExplainerNote() {
    return (
        <div
            className="flex items-start gap-3 border p-5 text-[15px] md:p-6"
            style={{ borderColor: 'rgba(126,233,255,0.3)', color: TEXT_BODY, backgroundColor: PANEL_BG }}
        >
            <Info size={18} className="mt-0.5 shrink-0" style={{ color: CYAN }} />
            <span>
                Your gold is counted in the net worth on your Money page — this panel just keeps it visually
                separate, so a swing in the gold price doesn't get lost in the bigger number.
            </span>
        </div>
    );
}
