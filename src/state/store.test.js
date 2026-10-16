// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { list, put, merge, remove } from '../lib/doc';

// A tiny in-memory stand-in for the one Supabase table the app uses, with the same
// compare-and-swap behaviour: an update filtered on updated_at matches nothing once the row moved.
const db = { row: null, failNext: false, clock: Date.parse('2026-10-16T10:00:00Z') };
const nextRev = () => new Date((db.clock += 1000)).toISOString();

function table() {
    const filters = {};
    let mode = null;
    let patch = null;
    let columns = '*';
    const api = {
        select(cols = '*') { columns = cols; if (!mode) mode = 'select'; return api; },
        eq(column, value) { filters[column] = value; return api; },
        insert(row) { mode = 'insert'; patch = row; return api; },
        update(values) { mode = 'update'; patch = values; return api; },
        maybeSingle() { return api.then((r) => ({ data: r.data[0] || null, error: r.error })); },
        then(resolve, reject) {
            const run = () => {
                if (db.failNext) { db.failNext = false; return { data: null, error: { message: 'offline' } }; }
                const matches = db.row && Object.entries(filters).every(([k, v]) => db.row[k] === v);
                if (mode === 'select') {
                    if (!matches) return { data: [], error: null };
                    return { data: [columns === '*' ? structuredClone(db.row) : { updated_at: db.row.updated_at }], error: null };
                }
                if (mode === 'insert') {
                    if (db.row) return { data: null, error: { code: '23505', message: 'duplicate' } };
                    db.row = structuredClone({ ...patch, updated_at: nextRev() });
                    return { data: [{ updated_at: db.row.updated_at }], error: null };
                }
                if (!matches) return { data: [], error: null };
                db.row = { ...db.row, ...structuredClone(patch), updated_at: nextRev() };
                return { data: [{ updated_at: db.row.updated_at }], error: null };
            };
            return Promise.resolve(run()).then(resolve, reject);
        },
    };
    return api;
}

vi.mock('./supabase', () => ({ supabase: { from: () => table() } }));

const session = { user: { id: 'user-1', email: 'a@b.c' } };
const legacyRow = () => ({
    user_id: 'user-1',
    currency: 'TRY',
    cards: [{ id: 1, name: 'Ziraat', limit: 50000, money: 886.18, debt: 33071.17, currency: 'TRY' }],
    funds: [{ id: 'f', name: 'EUR cash', amount: 400, currency: 'EUR' }],
    others: [],
    history: [{ id: 'h', date: '2026-01-07T00:00:00Z', overallNet: 1, totalAssets: 1, totalDebt: 0 }],
    gold_grams: 0,
    extended_data: { investments: [], version: 2 },
    updated_at: '2026-10-16T09:00:00.000Z',
});

let store;
beforeEach(async () => {
    vi.resetModules();
    window.localStorage.clear();
    db.row = null;
    db.failNext = false;
    store = await import('./store');
});

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('clean start over the previous version', () => {
    it('starts empty, wipes the old columns and keeps no copy of old data', async () => {
        db.row = legacyRow();
        window.localStorage.setItem('finance_cards_v3', '[{"id":1}]');
        window.localStorage.setItem('demo_cards_v3', '[]');
        window.localStorage.setItem('fx_rates_v1', '{}');
        await store.start(session);
        const { row } = db;
        expect(row.extended_data.version).toBe(5);
        expect(Object.keys(row.extended_data)).toEqual(['version', 'doc']);
        expect(row).toMatchObject({ cards: [], funds: [], others: [], history: [], gold_grams: 0 });
        expect(list(row.extended_data.doc, 'accounts')).toHaveLength(0);
        expect(list(row.extended_data.doc, 'snapshots')).toHaveLength(0);
        expect(row.extended_data.doc.settings.displayCurrency.value).toBe('TRY');
        expect(Object.keys(window.localStorage).filter((k) => /^(finance_|demo_|fx_rates)/.test(k))).toEqual([]);
        expect(store.getState().dirty).toBe(false);
        store.stop();
    });

    it('creates a row for a brand-new account', async () => {
        await store.start(session);
        expect(db.row.extended_data.version).toBe(5);
        expect(db.row.cards).toEqual([]);
        store.stop();
    });
});

describe('deletes', () => {
    it('stay deleted when a stale device that was already open saves later', async () => {
        db.row = legacyRow();
        await store.start(session); // this store is device B, open the whole time
        store.update((doc) => put(doc, 'tx', { id: 'x', type: 'expense', amount: 9, currency: 'TRY', date: '2026-10-16' }));
        await store.syncNow();

        // Device A deletes it and saves.
        const deletedOnA = remove(db.row.extended_data.doc, 'tx', 'x');
        db.row = { ...db.row, extended_data: { version: 5, doc: deletedOnA }, updated_at: nextRev() };

        // B, which still has x, saves an unrelated change.
        expect(store.getState().doc.tx.x.deleted).toBeUndefined();
        store.update((doc) => put(doc, 'tx', { id: 'y', type: 'expense', amount: 1, currency: 'TRY', date: '2026-10-16' }));
        await store.syncNow();
        await settle();

        expect(db.row.extended_data.doc.tx.x.deleted).toBe(true);
        expect(list(db.row.extended_data.doc, 'tx').map((t) => t.id)).toEqual(['y']);
        expect(store.getState().doc.tx.x.deleted).toBe(true);
        store.stop();
    });

    it('stay deleted when a device that was closed comes back with its old copy', async () => {
        db.row = legacyRow();
        await store.start(session);
        store.update((doc) => put(doc, 'tx', { id: 'x', type: 'expense', amount: 9, currency: 'TRY', date: '2026-10-16' }));
        await store.syncNow();
        const staleCopy = window.localStorage.getItem('pv5:user-1'); // device B's storage, frozen here
        store.update((doc) => remove(doc, 'tx', 'x'));
        await store.syncNow();
        store.stop();

        // Device B opens with the copy from before the delete, plus an unsent edit of its own.
        vi.resetModules();
        window.localStorage.clear();
        const stale = JSON.parse(staleCopy);
        stale.doc = put(stale.doc, 'tx', { id: 'z', type: 'expense', amount: 2, currency: 'TRY', date: '2026-10-16' });
        stale.dirty = true;
        window.localStorage.setItem('pv5:user-1', JSON.stringify(stale));
        const deviceB = await import('./store');
        await deviceB.start(session);
        await deviceB.syncNow();
        await settle();

        expect(db.row.extended_data.doc.tx.x.deleted).toBe(true);
        expect(list(db.row.extended_data.doc, 'tx').map((t) => t.id)).toEqual(['z']);
        deviceB.stop();
    });
});

describe('conflicts', () => {
    it('never overwrites a newer save from another device; merges instead', async () => {
        db.row = legacyRow();
        await store.start(session);

        // Another device saves an expense.
        const other = put(db.row.extended_data.doc, 'tx', { id: 'from-laptop', type: 'expense', amount: 100, currency: 'CZK', date: '2026-10-16' });
        db.row = { ...db.row, extended_data: { ...db.row.extended_data, doc: other }, updated_at: nextRev() };

        // This device, still on the older version, adds its own.
        store.update((doc) => put(doc, 'tx', { id: 'from-phone', type: 'expense', amount: 200, currency: 'CZK', date: '2026-10-16' }));
        await store.syncNow();
        await settle();

        const ids = list(db.row.extended_data.doc, 'tx').map((t) => t.id).sort();
        expect(ids).toEqual(['from-laptop', 'from-phone']);
        expect(list(store.getState().doc, 'tx')).toHaveLength(2);
        expect(store.getState().dirty).toBe(false);
        store.stop();
    });

    it('puts v5 data back if a tab running the old app overwrote the row', async () => {
        db.row = legacyRow();
        await store.start(session);
        store.update((doc) => put(doc, 'tx', { id: 'keep-me', type: 'expense', amount: 1, currency: 'TRY', date: '2026-10-16' }));
        await store.syncNow();
        db.row = { ...db.row, extended_data: { investments: [], version: 2 }, updated_at: nextRev() };
        await store.syncNow();
        await settle();
        expect(db.row.extended_data.version).toBe(5);
        expect(list(db.row.extended_data.doc, 'tx').map((t) => t.id)).toContain('keep-me');
        store.stop();
    });
});

describe('offline', () => {
    it('keeps edits locally and sends them when the connection is back', async () => {
        db.row = legacyRow();
        await store.start(session);
        db.failNext = true;
        store.update((doc) => put(doc, 'tx', { id: 'offline', type: 'expense', amount: 5, currency: 'TRY', date: '2026-10-16' }));
        await store.syncNow();
        expect(store.getState().dirty).toBe(true);
        expect(['error', 'offline']).toContain(store.getState().sync.state);
        expect(JSON.parse(window.localStorage.getItem('pv5:user-1')).doc.tx.offline).toBeTruthy();
        await store.syncNow();
        expect(db.row.extended_data.doc.tx.offline).toBeTruthy();
        expect(store.getState().dirty).toBe(false);
        store.stop();
    });

    it('a second device that already has local data merges with the cloud on start', async () => {
        db.row = legacyRow();
        await store.start(session);
        const cloudDoc = db.row.extended_data.doc;
        store.stop();
        const local = put(cloudDoc, 'tx', { id: 'unsent', type: 'expense', amount: 3, currency: 'TRY', date: '2026-10-16' });
        window.localStorage.setItem('pv5:user-1', JSON.stringify({ doc: local, baseRev: 'stale', dirty: true }));
        await store.start(session);
        await store.syncNow();
        expect(db.row.extended_data.doc.tx.unsent).toBeTruthy();
        expect(merge(local, db.row.extended_data.doc).tx.unsent).toBeTruthy();
        store.stop();
    });
});
