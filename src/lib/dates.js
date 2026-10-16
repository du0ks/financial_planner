// Calendar dates are plain 'YYYY-MM-DD' strings in the user's local time, months are
// 'YYYY-MM'. String comparison then orders them correctly and no timezone can shift a
// purchase into the previous day.

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(now = new Date()) {
    return toISODate(now);
}

export const monthOf = (isoDate) => isoDate.slice(0, 7);

export function parseISODate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d || 1);
}

export function daysInMonth(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

export function addMonths(month, count) {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1 + count, 1);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function addDays(isoDate, count) {
    const date = parseISODate(isoDate);
    date.setDate(date.getDate() + count);
    return toISODate(date);
}

/** Whole days from a to b (b later → positive). */
export function daysBetween(a, b) {
    return Math.round((parseISODate(b) - parseISODate(a)) / 86400000);
}

/** The date a day-of-month lands on in a given month; the 31st becomes the 30th in April. */
export function dayInMonth(month, day) {
    return `${month}-${pad(Math.min(Math.max(1, day || 1), daysInMonth(month)))}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(month, { year = true } = {}) {
    const [y, m] = month.split('-').map(Number);
    return year ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}

export function formatDate(isoDate, { year = false } = {}) {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    return year ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

export function monthRange(from, to) {
    const out = [];
    for (let month = from; month <= to; month = addMonths(month, 1)) out.push(month);
    return out;
}

/** The next date (today or later) that falls on a given day of the month. */
export function nextDayOfMonth(todayDate, day) {
    const month = monthOf(todayDate);
    const thisMonth = dayInMonth(month, day);
    return thisMonth >= todayDate ? thisMonth : dayInMonth(addMonths(month, 1), day);
}
