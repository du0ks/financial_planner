import { get, list, newId, put, putSetting, remove, stamp } from '../lib/doc';
import { occurrenceId } from '../lib/ledger';
import { pickRates } from '../lib/fx';
import { makeSnapshot } from '../lib/snapshots';
import { readSettings } from '../lib/model';
import { today as todayISO } from '../lib/dates';
import { latestRates } from './market';
import { getState, update } from './store';

// Every change to the data goes through here. Each function is one store.update(), so one
// user action is one save.

/** Freezes today's rates into fxDays when a record dated today is written. */
function freezeToday(doc, date, extraCodes = []) {
    if (date !== todayISO() || doc.fxDays?.[date]) return doc;
    const rates = latestRates();
    if (!rates) return doc;
    const settings = readSettings(doc);
    const codes = new Set([...settings.currencies, settings.displayCurrency, ...extraCodes]);
    return put(doc, 'fxDays', { id: date, rates: pickRates(rates, codes), overrides: settings.fxOverrides }, stamp());
}

export function setSetting(key, value) {
    update((doc) => putSetting(doc, key, value));
}

// ---------- accounts & cards ----------

function writeAnchor(doc, accountId, amount) {
    const setAt = stamp();
    return put(doc, 'anchors', { id: newId('anchor'), accountId, amount, date: todayISO(), setAt }, setAt);
}

/** Saves an account; `balance` (minor units) is only written when it changed. */
export function saveAccount(account, balance, currentBalance) {
    update((doc) => {
        const id = account.id || newId('acct');
        let next = put(doc, 'accounts', { order: list(doc, 'accounts').length, ...account, id });
        if (balance !== null && balance !== undefined && balance !== currentBalance) next = writeAnchor(next, id, balance);
        return next;
    });
}

export function accountInUse(doc, id) {
    return list(doc, 'tx').some((tx) => tx.accountId === id || tx.toAccountId === id)
        || list(doc, 'rules').some((rule) => rule.accountId === id);
}

export function deleteAccount(id) {
    update((doc) => {
        let next = remove(doc, 'accounts', id);
        for (const anchor of list(doc, 'anchors')) if (anchor.accountId === id) next = remove(next, 'anchors', anchor.id);
        for (const card of list(doc, 'accounts')) {
            if (card.linkedAccountId === id) next = put(next, 'accounts', { ...card, linkedAccountId: null });
        }
        return next;
    });
}

/**
 * Saves a card and the account at the same bank.
 * deposit: { mode: 'existing', id } | { mode: 'new', balance } | { mode: 'none' }
 */
export function saveCard(card, { debt, currentDebt, deposit, depositBalance, currentDepositBalance }) {
    update((doc) => {
        const id = card.id || newId('card');
        let next = doc;
        let linkedAccountId = null;
        if (deposit.mode === 'existing') linkedAccountId = deposit.id;
        if (deposit.mode === 'new') {
            linkedAccountId = newId('acct');
            next = put(next, 'accounts', { id: linkedAccountId, name: `${card.name} account`, kind: 'bank', currency: card.currency, available: true, order: list(doc, 'accounts').length + 1 });
            next = writeAnchor(next, linkedAccountId, depositBalance || 0);
        } else if (linkedAccountId && depositBalance !== null && depositBalance !== undefined && depositBalance !== currentDepositBalance) {
            next = writeAnchor(next, linkedAccountId, depositBalance);
        }
        next = put(next, 'accounts', { order: list(doc, 'accounts').length, ...card, id, kind: 'credit', linkedAccountId });
        if (debt !== null && debt !== undefined && debt !== currentDebt) next = writeAnchor(next, id, -debt);
        return next;
    });
}

/** Saves a card's interest rules without touching its balance or bank account. */
export function saveCardTerms(id, terms) {
    update((doc) => {
        const card = get(doc, 'accounts', id);
        return card ? put(doc, 'accounts', { ...card, ...terms }) : doc;
    });
}

// ---------- transactions ----------

export function saveTx(tx) {
    update((doc) => {
        const id = tx.id || newId('tx');
        const next = freezeToday(doc, tx.date, [tx.currency]);
        return put(next, 'tx', { ...tx, id });
    });
}

export function deleteTx(id) {
    update((doc) => remove(doc, 'tx', id));
}

export function confirmOccurrence(occurrence, { amount, accountId, date, note }) {
    const { rule, month } = occurrence;
    saveTx({
        id: occurrenceId(rule.id, month),
        type: rule.type,
        amount,
        currency: rule.currency,
        accountId: accountId || null,
        categoryId: rule.categoryId,
        date,
        note: note || '',
        ruleId: rule.id,
        ruleMonth: month,
        recurring: true,
    });
}

export function skipOccurrence(occurrence) {
    const { rule, month, date } = occurrence;
    update((doc) => put(doc, 'tx', {
        id: occurrenceId(rule.id, month), type: rule.type, amount: 0, currency: rule.currency,
        date, ruleId: rule.id, ruleMonth: month, skipped: true, recurring: true, categoryId: rule.categoryId,
    }));
}

/**
 * Resolves a debt between people.
 *   paid      — you paid it back (iOwe) from `accountId`: an outflow, not new spending
 *   received  — they paid you back (owedToMe) into `accountId`: an inflow, not income
 *   cancel    — it won't happen
 *   certain   — it is no longer a maybe
 */
export function resolveDebt(tx, action, { accountId, date, amount } = {}) {
    update((doc) => {
        const current = get(doc, 'tx', tx.id);
        if (!current) return doc;
        if (action === 'certain') return put(doc, 'tx', { ...current, debt: { ...current.debt, certainty: 'certain' } });
        let next = put(doc, 'tx', { ...current, debt: { ...current.debt, status: action === 'cancel' ? 'cancelled' : 'settled' } });
        if (action === 'paid' || action === 'received') {
            const settleDate = date || todayISO();
            next = freezeToday(next, settleDate, [current.currency]);
            next = put(next, 'tx', {
                id: newId('tx'),
                type: action === 'paid' ? 'expense' : 'income',
                amount: amount ?? current.debt.amount ?? current.amount,
                currency: current.currency,
                accountId: accountId || null,
                categoryId: current.categoryId,
                date: settleDate,
                settlesTxId: current.id,
                note: current.note || '',
            });
        }
        return next;
    });
}

// ---------- rules, plans, budgets, goals ----------

export function saveRecord(collection, record, prefix) {
    update((doc) => put(doc, collection, { ...record, id: record.id || newId(prefix) }));
}

export function deleteRecord(collection, id) {
    update((doc) => remove(doc, collection, id));
}

export function saveBudget(categoryId, amount, currency) {
    update((doc) => {
        const existing = list(doc, 'budgets').find((b) => b.categoryId === categoryId);
        if (amount === null) return existing ? remove(doc, 'budgets', existing.id) : doc;
        return put(doc, 'budgets', { id: existing?.id || newId('budget'), categoryId, amount, currency });
    });
}

export function mergeCategory(fromId, toId) {
    update((doc) => {
        let next = doc;
        for (const tx of list(doc, 'tx')) if (tx.categoryId === fromId) next = put(next, 'tx', { ...tx, categoryId: toId });
        for (const rule of list(doc, 'rules')) if (rule.categoryId === fromId) next = put(next, 'rules', { ...rule, categoryId: toId });
        const budgets = list(doc, 'budgets');
        const from = budgets.find((b) => b.categoryId === fromId);
        if (from) {
            const hasTarget = budgets.some((b) => b.categoryId === toId);
            next = hasTarget ? remove(next, 'budgets', from.id) : put(next, 'budgets', { ...from, categoryId: toId });
        }
        return remove(next, 'categories', fromId);
    });
}

export function categoryInUse(doc, id) {
    return list(doc, 'tx').some((tx) => tx.categoryId === id) || list(doc, 'rules').some((r) => r.categoryId === id);
}

// ---------- gold ----------

export function saveGoldEvent(event) {
    update((doc) => {
        const next = freezeToday(doc, event.date, event.currency ? [event.currency] : []);
        return put(next, 'goldEvents', { ...event, id: event.id || newId('gold') });
    });
}

// ---------- snapshots ----------

export function saveSnapshot(model) {
    update((doc) => put(doc, 'snapshots', makeSnapshot(model)));
}

// ---------- import ----------

export function importTransactions(rows) {
    update((doc) => {
        let next = doc;
        const categories = list(doc, 'categories');
        const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
        for (const row of rows) {
            let categoryId = row.categoryId;
            if (!categoryId && row.categoryName) {
                const key = row.categoryName.toLowerCase();
                if (!byName.has(key)) {
                    const id = newId('cat');
                    next = put(next, 'categories', { id, name: row.categoryName, icon: 'dots', order: byName.size + 1 });
                    byName.set(key, id);
                }
                categoryId = byName.get(key);
            }
            next = put(next, 'tx', {
                id: newId('tx'), type: 'expense', date: row.date, amount: row.amount, currency: row.currency,
                accountId: row.accountId || null, categoryId: categoryId || 'cat_other', note: row.note || '',
                createdAt: 1, // older than any balance you typed, so imports never move today's balances
            });
        }
        return next;
    });
}

/** Records needing a frozen rate set for their date. Used by the FxFreezer. */
export function datesNeedingRates(doc) {
    const settings = readSettings(doc);
    const needed = new Map();
    const want = (date, code) => {
        if (!date) return;
        if (!needed.has(date)) needed.set(date, new Set([...settings.currencies, settings.displayCurrency]));
        if (code) needed.get(date).add(code);
    };
    for (const tx of list(doc, 'tx')) if (!tx.skipped) want(tx.date, tx.currency);
    for (const event of list(doc, 'goldEvents')) if (event.price) want(event.date, event.currency);
    const out = [];
    for (const [date, codes] of needed) {
        const day = get(doc, 'fxDays', date);
        const missing = [...codes].filter((code) => !day?.rates?.[code]);
        if (missing.length) out.push({ date, codes: [...codes] });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function writeFxDay(date, rates, codes) {
    update((doc) => {
        const day = get(doc, 'fxDays', date);
        const settings = readSettings(doc);
        const picked = pickRates(rates, codes);
        return put(doc, 'fxDays', {
            id: date,
            rates: { ...picked, ...(day?.rates || {}) },
            overrides: day?.overrides || settings.fxOverrides,
        });
    });
}

export const currentDoc = () => getState().doc;
