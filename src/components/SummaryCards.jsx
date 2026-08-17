import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatMoney } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md) — this file now renders the
// Money screen's hero panel only. The old nine-stat-card grid is gone; "Your cards" totals
// live in Dashboard.jsx's section header instead.
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const TEXT_MUTED = '#bab8d8';
const TEXT_DIM = '#a6a4c4';
const TEXT_BODY = '#e2e0f7';

const DAY_MS = 24 * 60 * 60 * 1000;

// README (State Management): "newest snapshot at least 28 days old, overallNet - snapshot.overallNet."
function findBaselineSnapshot(history) {
    const cutoff = Date.now() - 28 * DAY_MS;
    const eligible = (history || []).filter((snap) => snap?.date && new Date(snap.date).getTime() <= cutoff);
    if (!eligible.length) return null;
    return eligible.reduce((newest, snap) => (
        new Date(snap.date).getTime() > new Date(newest.date).getTime() ? snap : newest
    ));
}

export default function SummaryCards({ totals, currency, history }) {
    const { overallNet, totalAssets } = totals;
    const baseline = findBaselineSnapshot(history);
    const delta = baseline ? overallNet - baseline.overallNet : null;
    const isDown = delta !== null && delta < 0;

    return (
        <section
            className="relative overflow-hidden border p-6 md:px-[34px] md:pb-[40px] md:pt-[38px]"
            style={{
                borderColor: 'rgba(126,233,255,0.30)',
                backgroundImage: 'linear-gradient(180deg, #0a0716 0%, #06040e 100%)',
            }}
        >
            <GridTexture />

            <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    <p
                        className="mb-4 font-mono text-[13px] font-medium uppercase tracking-[0.18em] md:text-[15px]"
                        style={{ color: TEXT_MUTED }}
                    >
                        Everything you own, minus what you owe
                    </p>
                    <div className="flex flex-wrap items-baseline gap-6">
                        <span
                            className="font-display text-[50px] font-extrabold leading-[0.9] tracking-[-0.03em] text-white md:text-[96px]"
                            style={{ textShadow: '0 0 22px rgba(126,233,255,0.35)' }}
                        >
                            {formatMoney(overallNet, currency)}
                        </span>
                        {delta !== null && <DeltaChip delta={delta} currency={currency} isDown={isDown} />}
                    </div>
                    {delta !== null && (
                        <p
                            className="mt-5 max-w-[600px] text-[17px] md:text-[19px]"
                            style={{ color: TEXT_BODY, textWrap: 'pretty' }}
                        >
                            {isDown
                                ? "You're a little behind last month. Worth keeping an eye on."
                                : "You're a little ahead of last month. Nothing needs your attention today."}
                        </p>
                    )}
                </div>

                <div className="shrink-0 md:text-right">
                    <p className="font-mono text-[14px]" style={{ color: TEXT_MUTED }}>Cash you can touch</p>
                    <p className="mt-2 font-mono text-[30px] font-semibold md:text-[38px]" style={{ color: CYAN }}>
                        {formatMoney(totalAssets, currency)}
                    </p>
                    <p className="mt-1 text-[15px] md:text-[16px]" style={{ color: TEXT_DIM }}>before paying card debt</p>
                </div>
            </div>

            <div
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ backgroundColor: MAGENTA, boxShadow: '0 0 16px 1px rgba(255,95,180,0.45)' }}
            />
        </section>
    );
}

function DeltaChip({ delta, currency, isDown }) {
    const Icon = isDown ? ArrowDownRight : ArrowUpRight;
    const color = isDown ? MAGENTA : CYAN;
    const sign = delta > 0 ? '+' : '';
    return (
        <span
            className="inline-flex items-center gap-2 border px-[14px] py-[9px] font-mono text-[15px] font-semibold md:text-[17px]"
            style={{
                borderColor: isDown ? 'rgba(255,95,180,0.5)' : 'rgba(126,233,255,0.5)',
                backgroundColor: isDown ? 'rgba(255,95,180,0.1)' : 'rgba(126,233,255,0.1)',
                color,
            }}
        >
            <Icon size={16} />
            {sign}{formatMoney(delta, currency)} this month
        </span>
    );
}

function GridTexture() {
    const mask = 'linear-gradient(180deg, transparent 10%, #000 94%)';
    return (
        <>
            <div
                className="pointer-events-none absolute inset-0 hidden opacity-[0.42] md:block"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(126,233,255,0.20) 0 1px, transparent 1px 68px),' +
                        'repeating-linear-gradient(0deg, rgba(255,95,180,0.14) 0 1px, transparent 1px 48px)',
                    maskImage: mask,
                    WebkitMaskImage: mask,
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.42] md:hidden"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(126,233,255,0.20) 0 1px, transparent 1px 48px),' +
                        'repeating-linear-gradient(0deg, rgba(255,95,180,0.14) 0 1px, transparent 1px 40px)',
                    maskImage: mask,
                    WebkitMaskImage: mask,
                }}
            />
        </>
    );
}
