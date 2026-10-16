import { AlertTriangle, Plus, Repeat, ShoppingBag, Target } from 'lucide-react';
import { useModel } from '../state/hooks';
import { saveRecord } from '../state/actions';
import { list } from '../lib/doc';
import { formatMonth, monthOf } from '../lib/dates';
import { bigPurchaseClashes, forecast, goalProgress, monthReport, monthlyCost, plannedEstimate } from '../lib/insights';
import { formatMoney, formatPercent } from '../lib/money';
import { Bar, Button, DualMoney, Empty, Panel, Row, cx } from '../ui/kit';
import { categoryIcon } from '../ui/icons';
import { openSheet } from '../ui/sheets';
import S from '../i18n/strings';

export default function PlanScreen() {
    const model = useModel();
    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="font-display text-[26px] font-bold text-white">{S.plan.title}</h1>
                <p className="mt-1 text-[15px] text-muted">{S.plan.subtitle}</p>
            </header>
            <Budget model={model} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Rules model={model} />
                <Planned model={model} />
            </div>
            <Forecast model={model} />
            <Goals model={model} />
        </div>
    );
}

export function BudgetRows({ model, report }) {
    const { doc, display } = model;
    const rows = report.rows.filter((r) => r.budget !== null || r.spent > 0);
    return rows.map((row) => {
        const category = doc.categories?.[row.categoryId];
        const tone = row.status === 'over' ? 'hot' : row.status === 'ahead' ? 'gold' : 'neon';
        return (
            <button key={row.categoryId} type="button" onClick={() => openSheet('budget', { categoryId: row.categoryId })} className="flex w-full flex-col gap-2 border-t border-line px-4 py-3 text-left first:border-t-0 hover:bg-white/[0.03] md:px-5">
                <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[15px] text-white">
                        {(() => { const Icon = categoryIcon(category); return <Icon size={16} className="shrink-0 text-muted" />; })()}
                        <span className="truncate">{category?.name || row.categoryId}</span>
                    </span>
                    <span className="tabular shrink-0 font-mono text-[14px] text-body">
                        {row.budget !== null
                            ? S.plan.spentOf(formatMoney(row.spent, display, { decimals: 'never' }), formatMoney(row.budget, display, { decimals: 'never' }))
                            : <>{formatMoney(row.spent, display, { decimals: 'never' })} <span className="text-dim">· {S.plan.noBudget}</span></>}
                    </span>
                </div>
                {row.budget !== null && (
                    <>
                        <Bar ratio={row.budget ? row.spent / row.budget : 0} tone={tone} marker={row.budget ? row.pace / row.budget : null} />
                        {row.projected !== row.spent && (
                            <span className={cx('text-[12px]', tone === 'neon' ? 'text-dim' : tone === 'gold' ? 'text-gold' : 'text-hot')}>
                                {S.plan.projected(formatMoney(row.projected, display, { decimals: 'never' }))}
                            </span>
                        )}
                    </>
                )}
            </button>
        );
    });
}

function Budget({ model }) {
    const { doc, display, fx, today } = model;
    const report = monthReport(doc, monthOf(today), display, fx, today);
    const hasBudget = list(doc, 'budgets').length > 0;
    return (
        <Panel
            title={S.plan.budgetTitle}
            subtitle={`${formatMonth(monthOf(today))} · ${S.insights.paceLine(report.elapsed, report.totalDays)}`}
            right={<Button size="sm" icon={Plus} onClick={() => openSheet('budget')}>{S.plan.setBudget}</Button>}
            bare
        >
            {!hasBudget && <Empty>{S.plan.budgetEmpty}</Empty>}
            <BudgetRows model={model} report={report} />
            {hasBudget && (
                <div className="flex justify-between border-t border-line px-4 py-3 md:px-5">
                    <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{S.plan.budgetTotal}</span>
                    <span className="tabular font-mono text-[14px] text-white">
                        {S.plan.spentOf(formatMoney(report.spending.total, display, { decimals: 'never' }), formatMoney(report.budgetTotal, display, { decimals: 'never' }))}
                    </span>
                </div>
            )}
        </Panel>
    );
}

function Rules({ model }) {
    const { doc, display } = model;
    const rules = list(doc, 'rules').sort((a, b) => (a.type === b.type ? a.dayOfMonth - b.dayOfMonth : a.type === 'income' ? -1 : 1));
    return (
        <Panel title={S.plan.rulesTitle} subtitle={S.plan.rulesExplain} bare>
            {rules.length === 0 && <Empty>{S.common.noneYet}</Empty>}
            {rules.map((rule) => (
                <Row
                    key={rule.id}
                    icon={Repeat}
                    iconTone={rule.type === 'income' ? 'neon' : 'hot'}
                    title={rule.name}
                    subtitle={`${S.common.everyMonthOn(rule.dayOfMonth)}${rule.endMonth ? ` · → ${formatMonth(rule.endMonth)}` : ''}`}
                    onClick={() => openSheet('rule', { rule })}
                    right={<DualMoney minor={rule.amount} currency={rule.currency} display={display} displayMinor={model.toDisplay(rule.amount, rule.currency)} tone={rule.type === 'income' ? 'neon' : null} />}
                />
            ))}
            <div className="grid grid-cols-2 gap-2 p-4">
                <Button variant="dashed" icon={Plus} onClick={() => openSheet('rule', { type: 'income' })}>{S.plan.addIncome}</Button>
                <Button variant="dashed" icon={Plus} onClick={() => openSheet('rule', { type: 'expense' })}>{S.plan.addBill}</Button>
            </div>
        </Panel>
    );
}

function Planned({ model }) {
    const { doc, settings } = model;
    const items = list(doc, 'planned').sort((a, b) => (a.status === b.status ? 0 : a.status === 'planned' ? -1 : 1) || (a.month || '').localeCompare(b.month || '') || (a.priority ?? 9) - (b.priority ?? 9));
    const clashes = new Set(bigPurchaseClashes(doc, settings.bigPurchaseLimit).map((c) => c.month));
    const estimate = (item) => {
        if (!item.min && !item.max) return S.plan.priceUnknown;
        if (item.min && item.max && item.min !== item.max) return `${formatMoney(item.min, item.currency, { decimals: 'never' })}–${formatMoney(item.max, item.currency, { decimals: 'never' })}`;
        return formatMoney(plannedEstimate(item), item.currency, { decimals: 'never' });
    };
    return (
        <Panel title={S.plan.plannedTitle} subtitle={S.plan.plannedExplain(settings.bigPurchaseLimit)} bare>
            {[...clashes].map((month) => (
                <p key={month} className="flex items-center gap-2 border-t border-line px-4 py-2 text-[13px] text-gold first:border-t-0 md:px-5"><AlertTriangle size={15} />{S.plan.clash(formatMonth(month))}</p>
            ))}
            {items.length === 0 && <Empty>{S.common.noneYet}</Empty>}
            {items.map((item) => (
                <Row
                    key={item.id}
                    icon={ShoppingBag}
                    iconTone={item.status !== 'planned' ? 'muted' : item.big ? 'gold' : 'neon'}
                    title={<span className={cx(item.status !== 'planned' && 'text-dim line-through')}>{item.name}</span>}
                    subtitle={[item.month && formatMonth(item.month), item.big && S.plan.bigTag, item.status !== 'planned' && (item.status === 'bought' ? S.plan.bought : S.plan.dropped), item.note].filter(Boolean).join(' · ')}
                    onClick={() => openSheet('planned', { item })}
                    right={(
                        <span className="flex flex-col items-end gap-1">
                            <span className="tabular font-mono text-[15px] text-white">{estimate(item)}</span>
                            {item.status === 'planned' && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Marked bought only once the expense is actually saved.
                                        openSheet('tx', {
                                            preset: { type: 'expense', amount: plannedEstimate(item) || undefined, currency: item.currency, categoryId: item.categoryId, note: item.name },
                                            onSaved: () => saveRecord('planned', { ...item, status: 'bought' }),
                                        });
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
                                    className="font-mono text-[11px] uppercase tracking-[0.08em] text-neon"
                                >
                                    {S.plan.markBought}
                                </span>
                            )}
                        </span>
                    )}
                />
            ))}
            <div className="p-4"><Button variant="dashed" icon={Plus} className="w-full" onClick={() => openSheet('planned')}>{S.plan.addPlanned}</Button></div>
        </Panel>
    );
}

function Forecast({ model }) {
    const { display, today } = model;
    const rows = forecast(model, today);
    const line = (label, key, sign, tone) => (
        <tr className="border-t border-line">
            <td className="py-2 pr-3 text-[13px] text-muted">{label}</td>
            {rows.map((r) => (
                <td key={r.month} className={cx('tabular py-2 pl-2 text-right font-mono text-[13px] md:text-[14px]', tone)}>
                    {r[key] ? `${sign}${formatMoney(r[key], display, { decimals: 'never' })}` : '—'}
                </td>
            ))}
        </tr>
    );
    return (
        <Panel title={S.plan.forecastTitle} subtitle={S.plan.forecastExplain}>
            <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[330px] border-collapse">
                    <thead>
                        <tr>
                            <th />
                            {rows.map((r) => <th key={r.month} className="pb-2 pl-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{formatMonth(r.month, { year: false })}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {line(S.plan.fcStart, 'start', '', 'text-body')}
                        {line(S.plan.fcIncome, 'income', '+', 'text-neon')}
                        {line(S.plan.fcBills, 'bills', '−', 'text-hot')}
                        {line(S.plan.fcDayToDay, 'dayToDay', '−', 'text-hot')}
                        {line(S.plan.fcPlanned, 'planned', '−', 'text-gold')}
                        <tr className="border-t border-line-strong">
                            <td className="py-2.5 pr-3 text-[14px] font-semibold text-white">{S.plan.fcEnd}</td>
                            {rows.map((r) => (
                                <td key={r.month} className={cx('tabular py-2.5 pl-2 text-right font-mono text-[15px] font-semibold', r.end < 0 ? 'text-hot' : 'text-white')}>
                                    {formatMoney(r.end, display, { decimals: 'never' })}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

function Goals({ model }) {
    const { doc, display, today, fx, settings } = model;
    const goals = list(doc, 'goals');
    const cost = monthlyCost(doc, today, display, fx, settings.costBasis)?.total;
    return (
        <Panel title={S.plan.goalsTitle} right={<Button size="sm" icon={Plus} onClick={() => openSheet('goal')}>{S.plan.addGoal}</Button>} bare>
            {goals.length === 0 && <Empty>{S.common.noneYet}</Empty>}
            {goals.map((goal) => {
                const progress = goalProgress(goal, model);
                return (
                    <Row key={goal.id} icon={Target} title={goal.name} onClick={() => openSheet('goal', { goal })}
                        subtitle={S.plan.goalProgress(formatMoney(progress.current, display, { decimals: 'never' }), formatMoney(progress.target, display, { decimals: 'never' }))
                            + (cost ? ` · ${S.goal.months((progress.current / cost).toFixed(1))}` : '')}
                        right={<span className="tabular font-mono text-[15px] text-neon">{progress.ratio === null ? '—' : formatPercent(progress.ratio, 0)}</span>}
                    >
                        <Bar ratio={progress.ratio} className="mt-2" />
                    </Row>
                );
            })}
        </Panel>
    );
}
