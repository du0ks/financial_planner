import { useMemo, useRef, useState } from 'react';
import { formatMoney } from '../lib/money';
import { formatDate, formatMonth, toISODate } from '../lib/dates';

// One series on a real time axis: points are placed by date, not by index, so a gap of
// eight months looks like eight months. Hover or tap anywhere to read the nearest point.

const W = 1000;
const H = 260;
const PAD = { left: 8, right: 8, top: 18, bottom: 30 };

function niceTicks(min, max, count = 4) {
    const span = max - min || Math.abs(max) || 1;
    const step0 = span / count;
    const magnitude = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= step0) || magnitude * 10;
    const ticks = [];
    for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
    return ticks;
}

function monthTicks(start, end) {
    const out = [];
    const d = new Date(start);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const span = (end - start) / 86400000;
    const every = span > 540 ? 6 : span > 270 ? 3 : span > 100 ? 2 : 1;
    while (d.getTime() <= end) {
        if (d.getMonth() % every === 0) out.push(d.getTime());
        d.setMonth(d.getMonth() + 1);
    }
    return out;
}

export default function TimeChart({ points, currency, label }) {
    const ref = useRef(null);
    const [active, setActive] = useState(null);
    const geometry = useMemo(() => {
        const times = points.map((p) => p.time);
        let t0 = Math.min(...times);
        let t1 = Math.max(...times);
        if (t1 - t0 < 86400000 * 7) t0 = t1 - 86400000 * 7;
        const values = points.map((p) => p.value);
        const ticks = niceTicks(Math.min(0, ...values), Math.max(...values));
        const v0 = ticks[0];
        const v1 = ticks[ticks.length - 1];
        const x = (t) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right);
        const y = (v) => H - PAD.bottom - ((v - v0) / (v1 - v0 || 1)) * (H - PAD.top - PAD.bottom);
        return { x, y, ticks, months: monthTicks(t0, t1), t0, t1 };
    }, [points]);

    const { x, y, ticks, months } = geometry;
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

    const pick = (clientX) => {
        const box = ref.current.getBoundingClientRect();
        const svgX = ((clientX - box.left) / box.width) * W;
        let best = 0;
        points.forEach((p, i) => { if (Math.abs(x(p.time) - svgX) < Math.abs(x(points[best].time) - svgX)) best = i; });
        setActive(best);
    };

    const shown = points[active ?? points.length - 1];
    return (
        <figure className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-muted">{shown.label || formatDate(toISODate(new Date(shown.time)), { year: true })}</span>
                <span className="tabular font-mono text-[16px] font-semibold text-white">{formatMoney(shown.value, currency, { decimals: 'never' })}</span>
            </div>
            <svg
                ref={ref}
                viewBox={`0 0 ${W} ${H}`}
                className="h-[200px] w-full touch-none select-none md:h-[260px]"
                preserveAspectRatio="none"
                role="img"
                aria-label={label}
                onPointerMove={(e) => pick(e.clientX)}
                onPointerDown={(e) => pick(e.clientX)}
                onPointerLeave={() => setActive(null)}
            >
                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" vectorEffect="non-scaling-stroke" />
                    </g>
                ))}
                {months.map((t) => (
                    <line key={t} x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.05)" vectorEffect="non-scaling-stroke" />
                ))}
                <path d={path} fill="none" stroke="var(--color-neon)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                {active !== null && (
                    <line x1={x(shown.time)} x2={x(shown.time)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.4)" vectorEffect="non-scaling-stroke" />
                )}
            </svg>
            {/* Markers and labels drawn in HTML so they stay round and crisp when the SVG stretches. */}
            <div className="relative -mt-[calc(200px+0.5rem)] h-[200px] md:-mt-[calc(260px+0.5rem)] md:h-[260px] pointer-events-none">
                {points.map((p, i) => (
                    <span
                        key={p.time}
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
                        style={{ left: `${(x(p.time) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%`, background: i === points.length - 1 || i === active ? 'var(--color-neon)' : 'var(--color-panel)', boxShadow: '0 0 0 2px var(--color-neon)' }}
                    />
                ))}
                {ticks.slice(1).map((t) => (
                    <span key={t} className="tabular absolute left-1 -translate-y-full font-mono text-[11px] text-dim" style={{ top: `${(y(t) / H) * 100}%` }}>
                        {formatMoney(Math.round(t), currency, { decimals: 'never' })}
                    </span>
                ))}
                {months.map((t) => (
                    <span key={t} className="absolute bottom-0 -translate-x-1/2 font-mono text-[11px] uppercase text-dim" style={{ left: `${(x(t) / W) * 100}%` }}>
                        {formatMonth(toISODate(new Date(t)).slice(0, 7), { year: false })}
                    </span>
                ))}
            </div>
        </figure>
    );
}
