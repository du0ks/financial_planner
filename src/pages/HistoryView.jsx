import { useState } from 'react';
import { Calendar, Trash2, Camera, Zap, TrendingUp, Award } from 'lucide-react';
import { formatMoney } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md) — Screen 3, History.
// The old Info modal is gone per the spec ("Removed on purpose"); the chart math
// (getPoints, padding 20, 1000x200 box) and the milestone helpers are unchanged from the
// pre-redesign file — only the strokes/colors/layout around them changed.
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const AMBER = '#ffc861';
const TEXT_MUTED = '#bab8d8';
const TEXT_DIM = '#a6a4c4';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';
const FIELD_BG = '#060410';
const TRACK_BG = '#16112a';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d) => `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;

function getNextMilestone(val) {
    if (val <= 0) return 5000;
    const magnitudes = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    return magnitudes.find((m) => m > val) || val * 1.2;
}

export default function HistoryView({ data }) {
    const { history = [], saveSnapshot, deleteSnapshot, totals, currency } = data;
    const { velocity, momentum, allTimeHigh, overallNet, totalAssets, totalDebt } = totals;

    const currentState = { date: new Date().toISOString(), overallNet, totalAssets, totalDebt, currency };
    const chartData = [...[...history].reverse(), currentState];
    const hasChart = chartData.length >= 2;

    const allAssetValues = chartData.map((s) => s.totalAssets);
    const allNetValues = chartData.map((s) => s.overallNet);
    const maxVal = Math.max(...allAssetValues, 1000);
    const minVal = Math.min(...allNetValues, 0);
    const range = maxVal - minVal || 1;

    const getPoints = (key) => {
        if (chartData.length < 2) return '';
        const width = 1000;
        const height = 200;
        const padding = 20;
        const plotWidth = width - padding * 2;
        const plotHeight = height - padding * 2;
        return chartData.map((s, i) => {
            const x = padding + (i / (chartData.length - 1)) * plotWidth;
            const y = height - (padding + ((s[key] - minVal) / range) * plotHeight);
            return `${x},${y}`;
        }).join(' ');
    };

    const netPoints = getPoints('overallNet');
    const netPointList = netPoints ? netPoints.split(' ').map((p) => p.split(',').map(Number)) : [];

    const nextMilestone = getNextMilestone(overallNet);
    const milestoneProgress = Math.max(0, Math.min(100, (overallNet / nextMilestone) * 100));

    const axisLabels = hasChart
        ? [
            shortDate(new Date(chartData[0].date)),
            shortDate(new Date(chartData[Math.floor((chartData.length - 1) / 2)].date)),
            `${shortDate(new Date(chartData[chartData.length - 1].date))} · today`,
        ]
        : [];

    return (
        <div className="flex flex-col gap-7 pb-6 md:gap-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-display text-[26px] font-bold text-white md:text-[34px]">How you're doing over time</h1>
                    <p className="mt-2 text-[15px] md:text-[17px]" style={{ color: TEXT_MUTED }}>
                        Every snapshot you save becomes a point on this line.
                    </p>
                </div>
                <SaveButton onClick={saveSnapshot} />
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
                <ChartPanel
                    hasChart={hasChart}
                    netPointList={netPointList}
                    getPoints={getPoints}
                    axisLabels={axisLabels}
                    nextMilestone={nextMilestone}
                    milestoneProgress={milestoneProgress}
                    currency={currency}
                />

                <div className="flex flex-col gap-4 md:gap-5">
                    <StatPanel icon={Zap} label="Growing per day" value={formatMoney(velocity, currency)} note="since your last snapshot" />
                    <StatPanel icon={TrendingUp} label="Average per day" value={formatMoney(momentum, currency)} note="across everything you saved" />
                    <StatPanel
                        icon={Award}
                        accent={AMBER}
                        label="Best ever"
                        value={formatMoney(allTimeHigh, currency)}
                        note={allTimeHigh <= overallNet ? "that's right now" : 'the most you have ever had'}
                    />
                </div>
            </div>

            <SnapshotTable history={history} deleteSnapshot={deleteSnapshot} currency={currency} />
        </div>
    );
}

function SaveButton({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex h-14 w-full items-center justify-center gap-2 font-mono text-[15px] font-semibold uppercase tracking-[0.1em] transition-colors md:h-[52px] md:w-fit md:px-6"
            style={{ backgroundColor: CYAN, color: '#050409' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = MAGENTA; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = CYAN; }}
        >
            <Camera size={17} />
            Save today's numbers
        </button>
    );
}

function ChartPanel({ hasChart, netPointList, getPoints, axisLabels, nextMilestone, milestoneProgress, currency }) {
    return (
        <div className="flex flex-col gap-5 border p-5 md:p-6" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="font-display text-[19px] font-semibold text-white md:text-[22px]">Net worth, last three months</h3>
                <div className="flex items-center gap-5 font-mono text-[13px]" style={{ color: TEXT_MUTED }}>
                    <span className="flex items-center gap-2">
                        <span className="h-[3px] w-[18px]" style={{ backgroundColor: CYAN }} />
                        Net worth
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-0 w-[18px] border-t-2 border-dashed" style={{ borderColor: MAGENTA }} />
                        Everything you own
                    </span>
                </div>
            </div>

            {hasChart ? (
                <>
                    <div className="relative h-[170px] border md:h-[240px]" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: FIELD_BG }}>
                        <ChartGridTexture />
                        <svg viewBox="0 0 1000 220" preserveAspectRatio="none" className="relative h-full w-full overflow-visible">
                            <defs>
                                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7ee9ff" stopOpacity="0.14" />
                                    <stop offset="100%" stopColor="#7ee9ff" stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            <path
                                d={`M ${getPoints('overallNet').split(' ')[0].split(',')[0]},200 L ${getPoints('overallNet')} L ${getPoints('overallNet').split(' ').pop().split(',')[0]},200 Z`}
                                fill="url(#netWorthFill)"
                            />
                            <polyline fill="none" stroke={MAGENTA} strokeWidth="2.5" strokeDasharray="8 7" points={getPoints('totalAssets')} />
                            <polyline fill="none" stroke={CYAN} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={getPoints('overallNet')} />

                            {netPointList.map(([x, y], i) => (
                                i === netPointList.length - 1 ? (
                                    <circle key={i} cx={x} cy={y} r="7" fill={CYAN} />
                                ) : (
                                    <circle key={i} cx={x} cy={y} r="6" fill="none" stroke={CYAN} strokeWidth="2" />
                                )
                            ))}
                        </svg>
                    </div>

                    <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.1em] md:text-[13px]" style={{ color: TEXT_MUTED }}>
                        {axisLabels.map((label, i) => <span key={i}>{label}</span>)}
                    </div>
                </>
            ) : (
                <div
                    className="flex h-[170px] flex-col items-center justify-center gap-2 border border-dashed px-6 text-center md:h-[240px]"
                    style={{ borderColor: 'rgba(255,255,255,0.18)', color: TEXT_DIM }}
                >
                    <TrendingUp size={32} style={{ color: CYAN, opacity: 0.4 }} />
                    <p className="text-[14px]">Save a couple of snapshots to start seeing your line.</p>
                </div>
            )}

            <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px]" style={{ color: TEXT_MUTED }}>
                        Next round number: {formatMoney(nextMilestone, currency)}
                    </span>
                    <span className="font-mono text-[13px] font-semibold" style={{ color: CYAN }}>{milestoneProgress.toFixed(0)}%</span>
                </div>
                <div className="h-3 w-full border" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: TRACK_BG }}>
                    <div
                        className="h-full transition-[width] duration-700"
                        style={{
                            width: `${milestoneProgress}%`,
                            backgroundImage: 'repeating-linear-gradient(135deg, #7ee9ff 0 6px, #3fa8bd 6px 12px)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function ChartGridTexture() {
    return (
        <div
            className="pointer-events-none absolute inset-0"
            style={{
                backgroundImage:
                    'repeating-linear-gradient(90deg, rgba(126,233,255,0.09) 0 1px, transparent 1px 76px),' +
                    'repeating-linear-gradient(0deg, rgba(126,233,255,0.09) 0 1px, transparent 1px 40px)',
            }}
        />
    );
}

function StatPanel({ icon, accent = CYAN, label, value, note }) {
    const Icon = icon;
    return (
        <div className="border p-4 md:flex md:flex-1 md:flex-col md:justify-center md:gap-3 md:p-5" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            {/* Mobile: single-line row, label left / value right. Desktop: full block, value+note below. */}
            <div className="flex items-center justify-between gap-3 md:justify-start">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border"
                        style={{ borderColor: accent, backgroundColor: `${accent}1a` }}
                    >
                        <Icon size={17} style={{ color: accent }} />
                    </div>
                    <h3 className="font-display text-[17px] font-semibold text-white md:text-[18px]">{label}</h3>
                </div>
                <span className="font-mono text-[19px] font-semibold text-white md:hidden">{value}</span>
            </div>
            <p className="mt-3 hidden font-mono text-[26px] font-semibold text-white md:block md:text-[30px]">{value}</p>
            <p className="mt-1 hidden text-[15px] md:block" style={{ color: TEXT_MUTED }}>{note}</p>
        </div>
    );
}

function SnapshotTable({ history, deleteSnapshot, currency }) {
    return (
        <div className="border" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div className="px-5 py-5 md:px-6">
                <h3 className="font-display text-[20px] font-semibold text-white md:text-[22px]">Saved snapshots</h3>
            </div>

            {history.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border-t px-6 py-14 text-center" style={{ borderColor: 'rgba(255,255,255,0.09)', color: TEXT_DIM }}>
                    <Calendar size={32} style={{ opacity: 0.4 }} />
                    <p className="text-[15px]">Your financial story starts here — take a snapshot to record today.</p>
                </div>
            ) : (
                <>
                    <div
                        className="hidden border-t px-6 py-[14px] font-mono text-[13px] uppercase tracking-[0.14em] md:grid md:grid-cols-[200px_1fr_1fr_1fr_60px]"
                        style={{ borderColor: 'rgba(255,255,255,0.09)', color: TEXT_MUTED }}
                    >
                        <span>Date</span>
                        <span>Net worth</span>
                        <span>Owned</span>
                        <span>Owed</span>
                        <span />
                    </div>

                    <div>
                        {history.map((snapshot) => (
                            <SnapshotRow key={snapshot.id} snapshot={snapshot} onDelete={() => deleteSnapshot(snapshot.id)} currency={currency} />
                        ))}
                    </div>
                </>
            )}

            <p className="border-t px-5 py-4 text-[13px] md:px-6" style={{ borderColor: 'rgba(255,255,255,0.09)', color: TEXT_DIM }}>
                Save one every week or month — that's enough to see the trend.
            </p>
        </div>
    );
}

function SnapshotRow({ snapshot, onDelete, currency }) {
    const date = new Date(snapshot.date);
    const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const snapCurrency = snapshot.currency || currency;
    const border = { borderColor: 'rgba(255,255,255,0.09)' };

    return (
        <>
            {/* Mobile: date + net worth on one line, owned/owed on the next. */}
            <div className="flex flex-col gap-3 border-t px-5 py-[18px] md:hidden" style={border}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Calendar size={16} style={{ color: TEXT_DIM }} />
                        <div>
                            <p className="text-[17px] text-white">{dateLabel}</p>
                            <p className="font-mono text-[13px]" style={{ color: TEXT_DIM }}>{timeLabel}</p>
                        </div>
                    </div>
                    <span className="font-mono text-[20px] font-semibold text-white">{formatMoney(snapshot.overallNet, snapCurrency)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 font-mono text-[15px]">
                        <span style={{ color: CYAN }}>{formatMoney(snapshot.totalAssets, snapCurrency)}</span>
                        <span style={{ color: TEXT_DIM }}>owned</span>
                        <span style={{ color: MAGENTA }}>{formatMoney(snapshot.totalDebt, snapCurrency)}</span>
                        <span style={{ color: TEXT_DIM }}>owed</span>
                    </div>
                    <RemoveButton onClick={onDelete} />
                </div>
            </div>

            {/* Desktop: table row. */}
            <div className="hidden border-t px-6 py-[18px] md:grid md:grid-cols-[200px_1fr_1fr_1fr_60px] md:items-center" style={border}>
                <div className="flex items-center gap-3">
                    <Calendar size={16} style={{ color: TEXT_DIM }} />
                    <div>
                        <p className="text-[17px] text-white">{dateLabel}</p>
                        <p className="font-mono text-[13px]" style={{ color: TEXT_DIM }}>{timeLabel}</p>
                    </div>
                </div>
                <span className="font-mono text-[22px] font-semibold text-white">{formatMoney(snapshot.overallNet, snapCurrency)}</span>
                <span className="font-mono text-[19px]" style={{ color: CYAN }}>{formatMoney(snapshot.totalAssets, snapCurrency)}</span>
                <span className="font-mono text-[19px]" style={{ color: MAGENTA }}>{formatMoney(snapshot.totalDebt, snapCurrency)}</span>
                <RemoveButton onClick={onDelete} className="justify-self-center" />
            </div>
        </>
    );
}

function RemoveButton({ onClick, className = '' }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center border transition-colors ${className}`}
            style={{ borderColor: hover ? MAGENTA : 'rgba(255,255,255,0.18)' }}
        >
            <Trash2 size={15} style={{ color: hover ? MAGENTA : '#a6a4c4' }} />
        </button>
    );
}
