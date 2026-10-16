import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, ChevronRight, Info, Target, Trash2 } from 'lucide-react';
import { useModel } from '../state/hooks';
import { deleteRecord, saveSnapshot, setSetting } from '../state/actions';
import { historicalRates } from '../state/market';
import { list } from '../lib/doc';
import { addDays, addMonths, daysBetween, formatDate, formatMonth, monthOf } from '../lib/dates';
import { COST_BASES, buildAlerts, goalProgress, incomeBuys, monthReport, monthlyCost } from '../lib/insights';
import { isSpending, nextIncomeDate, txAmountIn, txInMonth } from '../lib/ledger';
import { decompose, makeSnapshot, snapshotValue } from '../lib/snapshots';
import { formatMoney, formatPercent, sumMinor } from '../lib/money';
import { Bar, Button, Empty, IconButton, Panel, Segmented, Stat, cx, toast } from '../ui/kit';
import { goTo } from '../ui/nav';
import TimeChart from '../ui/TimeChart';
import { TxRow } from './SpendScreen';
import { BudgetRows } from './PlanScreen';
import S from '../i18n/strings';

export default function InsightsScreen() {
    const model = useModel();
    const { doc, display, fx, today } = model;
    const month = monthOf(today);
    const report = useMemo(() => monthReport(doc, month, display, fx, today), [doc, month, display, fx, today]);
    const incomeRule = list(doc, 'rules').filter((r) => r.type === 'income').sort((a, b) => b.amount - a.amount)[0] || null;
    const [pastRates, setPastRates] = useState(null);
    useEffect(() => { historicalRates(addDays(today, -30)).then(setPastRates); }, [today]);

    const alerts = buildAlerts(model, today, { pastRates, incomeCurrency: incomeRule?.currency });

    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="font-display text-[26px] font-bold text-white">{S.insights.title}</h1>
                <p className="mt-1 text-[15px] text-muted">{S.insights.subtitle}</p>
            </header>
            <ThisMonth model={model} report={report} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Watch model={model} alerts={alerts} />
                <WhereItWent model={model} report={report} />
            </div>
            <NetWorth model={model} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Purchasing model={model} rule={incomeRule} />
                <div className="flex flex-col gap-6">
                    <Runway model={model} />
                    <Goals model={model} />
                </div>
            </div>
        </div>
    );
}

function ThisMonth({ model, report }) {
    const { doc, display, fx, today } = model;
    const payday = nextIncomeDate(doc, addDays(today, 1));
    // Same point last month: spending up to the same day of the month.
    const lastMonth = addMonths(monthOf(today), -1);
    const dayCut = `${lastMonth}-${today.slice(8, 10)}`;
    const lastToDate = sumMinor(txInMonth(doc, lastMonth).filter((tx) => isSpending(tx) && tx.date <= dayCut).map((tx) => txAmountIn(tx, display, doc, fx)));
    const change = lastToDate > 0 ? (report.spending.total - lastToDate) / lastToDate : null;
    const money = (minor) => formatMoney(minor, display, { decimals: 'never' });
    return (
        <Panel title={`${S.insights.monthTitle} · ${formatMonth(report.month)}`} subtitle={S.insights.paceLine(report.elapsed, report.totalDays)}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stat label={S.insights.spent} sub={report.budgetTotal ? `${S.insights.budget} ${money(report.budgetTotal)}` : null}>
                    <span className="tabular font-mono text-hot">{money(report.spending.total)}</span>
                </Stat>
                <Stat label={S.insights.projected} sub={change !== null ? S.insights.vsLastMonth(formatPercent(change, 0, { signed: true })) : null}>
                    <span className={cx('tabular font-mono', report.budgetTotal && report.projectedSpending > report.budgetTotal ? 'text-gold' : 'text-white')}>{money(report.projectedSpending)}</span>
                </Stat>
                <Stat label={S.insights.income}>
                    <span className="tabular font-mono text-neon">{money(report.income)}</span>
                </Stat>
                <Stat label={S.insights.savingsRate}>
                    <span className="tabular font-mono">{report.savingsRate === null ? '—' : formatPercent(report.savingsRate, 0)}</span>
                </Stat>
                <Stat label={S.insights.daysToSalary} sub={payday ? formatDate(payday) : null}>
                    <span className="tabular font-mono">{payday ? daysBetween(today, payday) : '—'}</span>
                </Stat>
            </div>
            {report.rows.length > 0 && <div className="-mx-4 mt-4 border-t border-line md:-mx-5"><BudgetRows model={model} report={report} /></div>}
        </Panel>
    );
}

function Watch({ model, alerts }) {
    const { display, doc } = model;
    const money = (minor, currency = display) => formatMoney(minor, currency, { decimals: 'never' });
    const text = (alert) => {
        const A = S.insights.alerts;
        const cat = (id) => doc.categories?.[id]?.name || id;
        switch (alert.kind) {
            case 'debts': return A.debts(alert.interest ? money(alert.interest) : null, alert.open);
            case 'cardDue': return A.cardDue(alert.card.name, formatDate(alert.due), alert.days);
            case 'overBudget': return A.overBudget(cat(alert.row.categoryId), money(alert.row.spent - alert.row.budget));
            case 'aheadOfPace': return A.aheadOfPace(cat(alert.row.categoryId), money(alert.row.projected), money(alert.row.budget));
            case 'bigClash': return A.bigClash(formatMonth(alert.clash.month), alert.clash.items.map((i) => i.name).join(', '));
            case 'planned': return A.planned(alert.item.name, formatMonth(alert.item.month));
            case 'snapshot': return A.snapshot(alert.days);
            case 'fxMove': return A.fxMove(alert.from, alert.to, formatPercent(alert.change, 1, { signed: true }));
            case 'negative': return A.negative;
            case 'missingRates': return A.missingRates(alert.codes.join(', '));
            default: return '';
        }
    };
    return (
        <Panel title={S.insights.watchTitle} bare>
            {alerts.length === 0 && <Empty>{S.insights.allClear}</Empty>}
            {alerts.map((alert) => {
                const Line = alert.link ? 'button' : 'p';
                return (
                    <Line
                        key={alert.key}
                        type={alert.link ? 'button' : undefined}
                        onClick={alert.link ? () => goTo(alert.link) : undefined}
                        className={cx('flex w-full items-start gap-3 border-t border-line px-4 py-3 text-left text-[15px] leading-snug first:border-t-0 md:px-5', alert.link && 'hover:bg-white/[0.03]')}
                    >
                        {alert.level === 'warn'
                            ? <AlertTriangle size={17} className="mt-0.5 shrink-0 text-gold" />
                            : <Info size={17} className="mt-0.5 shrink-0 text-neon" />}
                        <span className="flex-1 text-body">{text(alert)}</span>
                        {alert.link && <ChevronRight size={17} className="mt-0.5 shrink-0 text-dim" />}
                    </Line>
                );
            })}
        </Panel>
    );
}

function WhereItWent({ model, report }) {
    const { doc, display } = model;
    const { spending } = report;
    const rows = Object.entries(spending.byCategory).sort((a, b) => b[1] - a[1]);
    const max = rows[0]?.[1] || 1;
    const money = (minor) => formatMoney(minor, display, { decimals: 'never' });
    return (
        <Panel title={S.insights.whereTitle} bare>
            {rows.length === 0 && <Empty>{S.spend.empty}</Empty>}
            {rows.length > 0 && (
                <div className="flex flex-col gap-3 p-4 md:p-5">
                    {rows.map(([id, minor]) => (
                        <div key={id} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[14px]">
                            <span className="truncate text-body">{doc.categories?.[id]?.name || id}</span>
                            <Bar ratio={minor / max} tone="hot" />
                            <span className="tabular w-20 text-right font-mono text-white">{money(minor)}</span>
                        </div>
                    ))}
                    <div className="mt-1 flex justify-between border-t border-line pt-3 text-[14px]">
                        <span className="text-muted">{S.insights.recurring} <span className="tabular font-mono text-white">{money(spending.recurring)}</span></span>
                        <span className="text-muted">{S.insights.oneOff} <span className="tabular font-mono text-white">{money(spending.oneOff)}</span></span>
                    </div>
                </div>
            )}
            {spending.top.length > 0 && (
                <>
                    <p className="border-t border-line bg-field px-4 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted md:px-5">{S.insights.top}</p>
                    {spending.top.map(({ tx }) => <TxRow key={tx.id} tx={tx} model={model} />)}
                </>
            )}
        </Panel>
    );
}

/** Legacy snapshots carry no prices; borrow the published rates of their own day. */
function useSnapshotPrices(snapshots) {
    const [prices, setPrices] = useState({});
    useEffect(() => {
        let alive = true;
        const need = snapshots.filter((s) => !s.prices);
        Promise.all(need.map((s) => historicalRates(s.date.slice(0, 10)).then((rates) => [s.id, rates ? { rates, overrides: {} } : null])))
            .then((entries) => { if (alive) setPrices(Object.fromEntries(entries)); });
        return () => { alive = false; };
    }, [snapshots]);
    return prices;
}

function NetWorth({ model }) {
    const { doc, display } = model;
    const snapshots = useMemo(() => list(doc, 'snapshots').sort((a, b) => a.date.localeCompare(b.date)), [doc]);
    const borrowed = useSnapshotPrices(snapshots);
    const withPrices = snapshots.map((s) => (s.prices ? s : { ...s, prices: borrowed[s.id] || null }));
    const now = useMemo(() => makeSnapshot(model, new Date().toISOString()), [model]);

    const points = withPrices
        .map((s) => ({ s, value: snapshotValue(s, display) }))
        .filter((p) => p.value)
        .map(({ s, value }) => ({ time: Date.parse(s.date), value: value.netWorth, label: formatDate(s.date.slice(0, 10), { year: true }) }));
    points.push({ time: Date.parse(now.date), value: model.totals.netWorth, label: S.common.today });

    const last = withPrices[withPrices.length - 1];
    const parts = last?.prices ? decompose(last, now, display) : null;
    const money = (minor) => formatMoney(minor, display, { decimals: 'never', signed: true });

    return (
        <Panel
            title={S.insights.netWorthTitle}
            subtitle={S.insights.netWorthExplain}
        >
            {points.length < 2 ? <Empty>{S.insights.noSnapshots}</Empty> : <TimeChart points={points} currency={display} label={S.insights.netWorthTitle} />}

            {parts && (
                <div className="mt-5 grid grid-cols-3 gap-2">
                    <Stat label={S.insights.saved}><span className={cx('tabular font-mono', parts.saved < 0 ? 'text-hot' : 'text-neon')}>{money(parts.saved)}</span></Stat>
                    <Stat label={S.insights.market}><span className={cx('tabular font-mono', parts.market < 0 ? 'text-hot' : 'text-neon')}>{money(parts.market)}</span></Stat>
                    <Stat label={S.insights.total} sub={S.insights.changeSince(formatDate(last.date.slice(0, 10), { year: true }))}><span className="tabular font-mono">{money(parts.total)}</span></Stat>
                </div>
            )}

            <Button className="mt-5 w-full md:w-auto" icon={Camera} onClick={() => { saveSnapshot(model); toast(S.money.snapshotSaved); }}>{S.money.snapshot}</Button>

            {withPrices.length > 0 && (
                <div className="-mx-4 mt-5 border-t border-line md:-mx-5">
                    <p className="px-4 pt-3 font-mono text-[12px] uppercase tracking-[0.1em] text-muted md:px-5">{S.insights.snapshotsTitle}</p>
                    {[...withPrices].reverse().map((s) => {
                        const value = snapshotValue(s, display);
                        return (
                            <div key={s.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 md:px-5">
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] text-white">{formatDate(s.date.slice(0, 10), { year: true })}</span>
                                </span>
                                <span className="tabular font-mono text-[15px] text-white">{value ? formatMoney(value.netWorth, display, { decimals: 'never' }) : '—'}</span>
                                <IconButton icon={Trash2} tone="hot" label={S.common.delete} onClick={() => { if (window.confirm(S.common.deleteConfirm(formatDate(s.date.slice(0, 10), { year: true })))) deleteRecord('snapshots', s.id); }} />
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

function Purchasing({ model, rule }) {
    const { doc, settings, today } = model;
    const targets = settings.currencies.filter((c) => c !== rule?.currency).slice(0, 3);
    const [months, setMonths] = useState([]);
    useEffect(() => {
        if (!rule) return undefined;
        let alive = true;
        const list12 = Array.from({ length: 12 }, (_, i) => addMonths(monthOf(today), -11 + i));
        Promise.all(list12.map((m) => historicalRates(`${m}-01`).then((rates) => ({ month: m, rates }))))
            .then((entries) => { if (alive) setMonths(entries.filter((e) => e.rates)); });
        return () => { alive = false; };
    }, [rule, today]);
    if (!rule || !targets.length) return null;
    const rows = incomeBuys(doc, rule, months, targets);
    const salary = formatMoney(rule.amount, rule.currency, { decimals: 'never' });
    return (
        <Panel title={S.insights.purchasingTitle} subtitle={S.insights.purchasingExplain}>
            {rows.length > 0 && <p className="mb-3 text-[13px] text-muted">{S.insights.purchasingChange(formatMonth(rows[0].month))}</p>}
            <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full border-collapse text-[14px]">
                    <thead>
                        <tr>
                            <th className="pb-2 text-left font-mono text-[12px] font-semibold uppercase text-muted">{S.common.month}</th>
                            {targets.map((code) => <th key={code} className="pb-2 text-right font-mono text-[12px] font-semibold uppercase text-muted">{code} <span className="text-dim">· %</span></th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {[...rows].reverse().map((row) => (
                            <tr key={row.month} className="border-t border-line">
                                <td className="py-1.5 text-body">{formatMonth(row.month)}{row.assumed && <span className="text-gold">*</span>}</td>
                                {targets.map((code) => {
                                    const v = row.values[code];
                                    const change = row.change[code];
                                    return (
                                        <td key={code} className={cx('tabular py-1.5 text-right font-mono', row.assumed ? 'text-muted' : 'text-white')}>
                                            {v === null ? '—' : formatMoney(v, code, { decimals: 'never' })}
                                            {change !== null && <span className={cx('ml-2 text-[12px]', change < 0 ? 'text-hot' : 'text-neon')}>{formatPercent(change, 0, { signed: true })}</span>}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.some((r) => r.assumed) && <p className="mt-3 text-[13px] leading-snug text-gold">{S.insights.purchasingAssumed(salary)}</p>}
        </Panel>
    );
}

function Runway({ model }) {
    const { doc, display, fx, today, totals, settings } = model;
    const cost = monthlyCost(doc, today, display, fx, settings.costBasis);
    const money = (minor) => formatMoney(minor, display, { decimals: 'never' });
    return (
        <Panel title={S.insights.runwayTitle} subtitle={cost ? S.insights.runwayExplain(money(totals.availableNow), money(cost.total)) : S.insights.noCost}>
            {cost && <p className="tabular font-display text-[40px] font-bold text-white">{S.insights.runway(Math.max(0, totals.availableNow / cost.total).toFixed(1))}</p>}
            <Segmented
                className="mt-3"
                value={settings.costBasis}
                onChange={(v) => setSetting('costBasis', v)}
                options={COST_BASES.map((value) => ({ value, label: S.insights.costBases[value] }))}
            />
            {cost && (
                <div className="mt-3 text-[14px]">
                    <p className="flex justify-between gap-3 py-1"><span className="text-muted">{S.insights.costBills}</span><span className="tabular font-mono text-white">{money(cost.bills)}</span></p>
                    {settings.costBasis === 'budget' && <p className="flex justify-between gap-3 py-1"><span className="text-muted">+ {S.insights.costBudgets}</span><span className="tabular font-mono text-white">{money(cost.budgets)}</span></p>}
                    <p className="flex justify-between gap-3 border-t border-line py-1.5 font-semibold"><span className="text-white">= {S.insights.costBases[settings.costBasis]}</span><span className="tabular font-mono text-white">{money(cost.total)}</span></p>
                    <p className="mt-2 text-[13px] leading-snug text-dim">{S.insights.costNote}</p>
                </div>
            )}
        </Panel>
    );
}

/** A short summary; goals are managed on Plan. */
function Goals({ model }) {
    const goals = list(model.doc, 'goals');
    if (!goals.length) return null;
    return (
        <Panel bare>
            <button type="button" onClick={() => goTo('plan')} className="flex w-full flex-col gap-2 p-4 text-left hover:bg-white/[0.03] md:p-5">
                <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-display text-[17px] font-semibold text-white"><Target size={17} className="text-neon" />{S.insights.goalsTitle}</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-dim">{S.insights.goalsMore}<ChevronRight size={14} /></span>
                </span>
                {goals.map((goal) => {
                    const p = goalProgress(goal, model);
                    return (
                        <span key={goal.id} className="flex items-center gap-3 text-[14px]">
                            <span className="min-w-0 flex-1 truncate text-body">{goal.name}</span>
                            <Bar ratio={p.ratio} className="w-24" />
                            <span className="tabular w-10 text-right font-mono text-neon">{p.ratio === null ? '—' : formatPercent(p.ratio, 0)}</span>
                        </span>
                    );
                })}
            </button>
        </Panel>
    );
}
