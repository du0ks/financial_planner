import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, CreditCard, Flag, Lock, Plus, Target, Trash2 } from 'lucide-react';
import { formatMoney, parseCloudNumber } from '../utils/format';

const EVENT_TYPES = [
    { value: 'milestone', label: 'Milestone' },
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
    { value: 'lock', label: 'Locked Cash' }
];

export default function PlannerView({ data }) {
    const {
        cards,
        others,
        incomes,
        events,
        currency,
        totals,
        convertCurrencyAmount,
        addEvent,
        updateEvent,
        removeEvent
    } = data;
    const [payoffInput, setPayoffInput] = useState('');

    const projection = useMemo(() => buildProjection({
        cards,
        others,
        incomes,
        events,
        totals,
        convertCurrencyAmount
    }), [cards, others, incomes, events, totals, convertCurrencyAmount]);

    const suggestedPayoff = useMemo(() => (
        Math.max(0, totals.expectedMonthlyIncome - totals.monthlyBurn)
    ), [totals.expectedMonthlyIncome, totals.monthlyBurn]);
    const payoffBudget = parseCloudNumber(payoffInput || suggestedPayoff);
    const payoffComparison = useMemo(() => ({
        avalanche: buildPayoffSchedule(cards, 'avalanche', payoffBudget, convertCurrencyAmount),
        snowball: buildPayoffSchedule(cards, 'snowball', payoffBudget, convertCurrencyAmount)
    }), [cards, payoffBudget, convertCurrencyAmount]);

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <section className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-green-500">
                            <BarChart3 size={20} />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Six Month Cash Flow</p>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Planner</h2>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-right dark:bg-gray-800/70">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Starting Liquid Cash</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{formatMoney(totals.totalFundCash, currency)}</p>
                    </div>
                </div>

                <CashChart projection={projection} events={events} currency={currency} />

                <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                    <table className="min-w-[760px] w-full text-left text-sm">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-800/70">
                            <tr>
                                <th className="px-4 py-3">Month</th>
                                <th className="px-4 py-3">Income</th>
                                <th className="px-4 py-3">Expenses</th>
                                <th className="px-4 py-3">CC Payments</th>
                                <th className="px-4 py-3">Interest</th>
                                <th className="px-4 py-3">Net Cash</th>
                                <th className="px-4 py-3">CC Debt Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projection.map(row => (
                                <tr
                                    key={row.key}
                                    className={`border-t border-gray-100 dark:border-gray-800 ${row.endingCash < 0 ? 'bg-red-50/80 dark:bg-red-950/20' : 'bg-white dark:bg-gray-900'}`}
                                >
                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{row.label}</td>
                                    <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatMoney(row.income, currency)}</td>
                                    <td className="px-4 py-3 text-red-500">{formatMoney(row.expenses, currency)}</td>
                                    <td className="px-4 py-3 text-purple-500">{formatMoney(row.cardPayments, currency)}</td>
                                    <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{formatMoney(row.interest, currency)}</td>
                                    <td className={`px-4 py-3 font-black ${row.netCash < 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>
                                        {formatMoney(row.netCash, currency)}
                                        {row.locked > 0 && <span className="mt-1 block text-[10px] font-bold text-gray-400">Locked {formatMoney(row.locked, currency)}</span>}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{formatMoney(row.debtRemaining, currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
                <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-purple-500">
                            <CreditCard size={20} />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Debt Payoff Calculator</p>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Avalanche vs Snowball</h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {cards.map(card => (
                                <span key={card.id} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-600 dark:bg-purple-900/20 dark:text-purple-300">
                                    {card.name}: {formatMoney(convertCurrencyAmount(card.debt, card.currency), currency)} at {parseFloat(card.interestRate) || 0}%
                                </span>
                            ))}
                        </div>
                    </div>
                    <label className="rounded-2xl bg-gray-50 p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-800/70">
                        Monthly Payoff Amount
                        <input
                            type="number"
                            inputMode="decimal"
                            value={payoffInput}
                            onChange={(event) => setPayoffInput(event.target.value)}
                            placeholder={String(Math.round(suggestedPayoff))}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-mono text-xl font-black text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <span className="mt-2 block normal-case tracking-normal text-green-600 dark:text-green-400">
                            Suggested from income minus burn: {formatMoney(suggestedPayoff, currency)}
                        </span>
                    </label>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <PayoffPanel title="Avalanche" subtitle="Highest interest first" payoff={payoffComparison.avalanche} currency={currency} />
                    <PayoffPanel title="Snowball" subtitle="Lowest balance first" payoff={payoffComparison.snowball} currency={currency} />
                </div>
            </section>

            <section className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-blue-500">
                            <Target size={20} />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Financial Events</p>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Milestones and one-time moves</h3>
                    </div>
                    <button
                        onClick={addEvent}
                        className="flex items-center justify-center gap-2 self-start rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                    >
                        <Plus size={16} />
                        Add Event
                    </button>
                </div>

                {events.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-gray-100 py-10 text-center text-sm font-medium text-gray-400 dark:border-gray-800">
                        Add milestones, one-time cash flows, or locked money dates for the projection.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[...events].sort((left, right) => new Date(left.date) - new Date(right.date)).map(event => (
                            <EventRow
                                key={event.id}
                                event={event}
                                updateEvent={updateEvent}
                                removeEvent={removeEvent}
                                currency={currency}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function CashChart({ projection, events, currency }) {
    const width = 1000;
    const height = 260;
    const padding = 36;
    const values = projection.map(row => row.endingCash);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    const points = projection.map((row, index) => {
        const x = padding + (index / Math.max(1, projection.length - 1)) * (width - padding * 2);
        const y = height - padding - ((row.endingCash - minValue) / range) * (height - padding * 2);
        return { x, y, row };
    });
    const pointString = points.map(point => `${point.x},${point.y}`).join(' ');
    const areaPath = points.length > 0
        ? `M ${points[0].x},${height - padding} L ${pointString} L ${points[points.length - 1].x},${height - padding} Z`
        : '';
    const markers = points.flatMap(point => (
        events
            .filter(event => event.type === 'milestone' && isSameMonth(event.date, point.row.date))
            .map(event => ({ ...point, event }))
    ));

    return (
        <div className="rounded-[28px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="h-72 w-full">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
                    <defs>
                        <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <line
                        x1={padding}
                        x2={width - padding}
                        y1={height - padding - ((0 - minValue) / range) * (height - padding * 2)}
                        y2={height - padding - ((0 - minValue) / range) * (height - padding * 2)}
                        stroke="#ef4444"
                        strokeDasharray="6 6"
                        strokeOpacity="0.3"
                    />
                    <path d={areaPath} fill="url(#cashGradient)" />
                    <polyline
                        points={pointString}
                        fill="none"
                        stroke="#22c55e"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="4"
                    />
                    {points.map(point => (
                        <g key={point.row.key}>
                            <circle cx={point.x} cy={point.y} r="6" fill={point.row.endingCash < 0 ? '#ef4444' : '#22c55e'} />
                            <text x={point.x} y={height - 10} textAnchor="middle" className="fill-gray-400 text-[20px] font-bold">
                                {point.row.shortLabel}
                            </text>
                        </g>
                    ))}
                    {markers.map(marker => (
                        <g key={`${marker.event.id}-${marker.row.key}`}>
                            <line x1={marker.x} x2={marker.x} y1={marker.y - 8} y2={padding} stroke="#3b82f6" strokeDasharray="4 4" />
                            <circle cx={marker.x} cy={padding} r="8" fill="#3b82f6" />
                        </g>
                    ))}
                </svg>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {projection.map(row => (
                    <span key={row.key} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 dark:bg-gray-900 dark:text-gray-300">
                        {row.label}: {formatMoney(row.endingCash, currency)}
                    </span>
                ))}
                {markers.map(marker => (
                    <span key={`${marker.event.id}-chip`} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                        {marker.event.name}
                    </span>
                ))}
            </div>
        </div>
    );
}

function PayoffPanel({ title, subtitle, payoff, currency }) {
    return (
        <article className="rounded-[28px] border border-gray-100 bg-gray-50/70 p-5 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h4 className="text-lg font-black text-gray-900 dark:text-white">{title}</h4>
                    <p className="text-xs font-bold text-gray-400">{subtitle}</p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-right dark:bg-gray-900">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Interest</p>
                    <p className="font-black text-amber-600 dark:text-amber-400">{formatMoney(payoff.totalInterest, currency)}</p>
                </div>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
                <SummaryPill label="Payoff Date" value={payoff.completionDate ? payoff.completionDate.toLocaleDateString() : 'Needs more cash'} />
                <SummaryPill label="Months" value={payoff.months ? String(payoff.months) : '-'} />
            </div>
            {payoff.schedule.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm font-medium text-gray-400 dark:border-gray-700">
                    Enter a monthly payoff amount above to model this strategy.
                </div>
            ) : (
                <div className="max-h-80 overflow-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="sticky top-0 bg-white text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-900">
                            <tr>
                                <th className="px-3 py-2">Month</th>
                                <th className="px-3 py-2">Paid</th>
                                <th className="px-3 py-2">Interest</th>
                                <th className="px-3 py-2">Debt Left</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payoff.schedule.map(row => (
                                <tr key={row.key} className="border-t border-gray-100 dark:border-gray-800">
                                    <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-100">{row.label}</td>
                                    <td className="px-3 py-2 text-purple-500">{formatMoney(row.paid, currency)}</td>
                                    <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{formatMoney(row.interest, currency)}</td>
                                    <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">{formatMoney(row.balance, currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </article>
    );
}

function SummaryPill({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-3 py-2 dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
            <p className="truncate text-sm font-black text-gray-900 dark:text-white">{value}</p>
        </div>
    );
}

function EventRow({ event, updateEvent, removeEvent, currency }) {
    const financialEvent = event.type !== 'milestone';

    return (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40 lg:grid-cols-[auto_minmax(0,1fr)_10rem_10rem_9rem_auto] lg:items-center">
            <div className={`rounded-xl p-2 ${getEventColor(event.type)}`}>
                {renderEventIcon(event.type)}
            </div>
            <input
                type="text"
                value={event.name}
                onChange={(changeEvent) => updateEvent(event.id, 'name', changeEvent.target.value)}
                className="min-w-0 bg-transparent font-bold text-gray-900 outline-none dark:text-white"
            />
            <input
                type="date"
                value={event.date || ''}
                onChange={(changeEvent) => updateEvent(event.id, 'date', changeEvent.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <select
                value={event.type}
                onChange={(changeEvent) => updateEvent(event.id, 'type', changeEvent.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
                {EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            {financialEvent ? (
                <label className="flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    <span className="mr-1 text-[10px] opacity-60">{currency}</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={event.amount || ''}
                        onChange={(changeEvent) => updateEvent(event.id, 'amount', parseCloudNumber(changeEvent.target.value))}
                        className="w-full min-w-0 bg-transparent outline-none"
                    />
                </label>
            ) : (
                <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-400 dark:bg-gray-900">Marker only</span>
            )}
            <button
                onClick={() => removeEvent(event.id)}
                className="justify-self-start rounded-xl p-2 text-gray-300 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 lg:justify-self-end"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
}

function buildProjection({ cards, others, incomes, events, totals, convertCurrencyAmount }) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() + index + 1, 1));
    let previousCash = totals.totalFundCash;
    let debtCards = cards.map(card => ({
        id: card.id,
        balance: convertCurrencyAmount(card.debt, card.currency),
        interestRate: parseFloat(card.interestRate) || 0,
        minimumPayment: convertCurrencyAmount(card.minimumPayment, card.currency)
    }));

    return months.map(month => {
        const recurringIncome = incomes.reduce((sum, income) => (
            incomeDueInMonth(income, month)
                ? sum + convertCurrencyAmount(income.amount, income.currency)
                : sum
        ), 0);
        const recurringExpenses = others.reduce((sum, expense) => (
            expense.isRecurring && dateWithinEnd(expense.endDate, month)
                ? sum + convertCurrencyAmount(expense.amount, expense.currency)
                : sum
        ), 0);
        const eventIncome = sumEvents(events, 'income', month);
        const eventExpenses = sumEvents(events, 'expense', month);
        const locked = sumEvents(events, 'lock', month);
        let interest = 0;
        let cardPayments = 0;

        debtCards = debtCards.map(card => {
            const monthInterest = card.balance * (card.interestRate / 100);
            const balanceWithInterest = card.balance + monthInterest;
            const payment = Math.min(balanceWithInterest, card.minimumPayment);
            interest += monthInterest;
            cardPayments += payment;
            return { ...card, balance: Math.max(0, balanceWithInterest - payment) };
        });

        const income = recurringIncome + eventIncome;
        const expenses = recurringExpenses + eventExpenses;
        const endingCash = previousCash + income - expenses - cardPayments - interest - locked;
        const row = {
            key: month.toISOString(),
            date: month,
            label: month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
            shortLabel: month.toLocaleDateString(undefined, { month: 'short' }),
            income,
            expenses,
            cardPayments,
            interest,
            locked,
            netCash: endingCash - previousCash,
            endingCash,
            debtRemaining: debtCards.reduce((sum, card) => sum + card.balance, 0)
        };
        previousCash = endingCash;
        return row;
    });
}

function buildPayoffSchedule(cards, strategy, monthlyBudget, convertCurrencyAmount) {
    let debtCards = cards
        .map(card => ({
            id: card.id,
            name: card.name,
            balance: convertCurrencyAmount(card.debt, card.currency),
            minimumPayment: convertCurrencyAmount(card.minimumPayment, card.currency),
            interestRate: parseFloat(card.interestRate) || 0
        }))
        .filter(card => card.balance > 0);

    if (debtCards.length === 0) {
        return { schedule: [], totalInterest: 0, completionDate: new Date(), months: 0 };
    }
    if (monthlyBudget <= 0) {
        return { schedule: [], totalInterest: 0, completionDate: null, months: null };
    }

    const schedule = [];
    let totalInterest = 0;

    for (let monthIndex = 1; monthIndex <= 240 && debtCards.length > 0; monthIndex += 1) {
        let remainingBudget = monthlyBudget;
        let paid = 0;
        let interest = 0;

        debtCards = debtCards.map(card => {
            const accrued = card.balance * (card.interestRate / 100);
            interest += accrued;
            return { ...card, balance: card.balance + accrued };
        });

        debtCards = debtCards.map(card => {
            const minimum = Math.min(card.balance, card.minimumPayment, remainingBudget);
            remainingBudget -= minimum;
            paid += minimum;
            return { ...card, balance: Math.max(0, card.balance - minimum) };
        });

        [...debtCards]
            .filter(card => card.balance > 0)
            .sort((left, right) => (
                strategy === 'avalanche'
                    ? right.interestRate - left.interestRate || right.balance - left.balance
                    : left.balance - right.balance || right.interestRate - left.interestRate
            ))
            .forEach(card => {
                if (remainingBudget <= 0) return;
                const target = debtCards.find(item => item.id === card.id);
                const extra = Math.min(target.balance, remainingBudget);
                target.balance -= extra;
                remainingBudget -= extra;
                paid += extra;
            });

        debtCards = debtCards.filter(card => card.balance > 0.01);
        totalInterest += interest;
        const date = new Date(new Date().getFullYear(), new Date().getMonth() + monthIndex, 1);
        schedule.push({
            key: `${strategy}-${date.toISOString()}`,
            date,
            label: date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
            paid,
            interest,
            balance: debtCards.reduce((sum, card) => sum + card.balance, 0)
        });
    }

    const complete = debtCards.length === 0;
    return {
        schedule,
        totalInterest,
        completionDate: complete ? schedule[schedule.length - 1]?.date : null,
        months: complete ? schedule.length : null
    };
}

function incomeDueInMonth(income, month) {
    if (income.isRecurring) {
        return dateOnOrAfter(income.date, month) && dateWithinEnd(income.endDate, month);
    }
    return isSameMonth(income.date, month);
}

function sumEvents(events, type, month) {
    return events.reduce((sum, event) => (
        event.type === type && isSameMonth(event.date, month) ? sum + (parseFloat(event.amount) || 0) : sum
    ), 0);
}

function isSameMonth(dateValue, month) {
    if (!dateValue) return false;
    const date = new Date(`${dateValue}T00:00:00`);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function dateOnOrAfter(dateValue, month) {
    if (!dateValue) return true;
    const date = new Date(`${dateValue}T00:00:00`);
    const itemMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    return month >= itemMonth;
}

function dateWithinEnd(endDate, month) {
    if (!endDate) return true;
    const date = new Date(`${endDate}T23:59:59`);
    return month <= new Date(date.getFullYear(), date.getMonth(), 1);
}

function renderEventIcon(type) {
    if (type === 'income') return <ArrowUpRight size={18} />;
    if (type === 'expense') return <ArrowDownRight size={18} />;
    if (type === 'lock') return <Lock size={18} />;
    return <Flag size={18} />;
}

function getEventColor(type) {
    if (type === 'income') return 'bg-green-500/10 text-green-500';
    if (type === 'expense') return 'bg-red-500/10 text-red-500';
    if (type === 'lock') return 'bg-amber-500/10 text-amber-500';
    return 'bg-blue-500/10 text-blue-500';
}
