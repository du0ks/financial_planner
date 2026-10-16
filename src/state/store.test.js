// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { list, put, merge } from '../lib/doc';

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

describe('upgrade from the previous version', () => {
    it('migrates the cloud row, keeps the legacy columns untouched and stores a backup', async () => {
        db.row = legacyRow();
        const before = structuredClone(db.row);
        await store.start(session);
        const { row } = db;
        expect(row.extended_data.version).toBe(5);
        expect(row.cards).toEqual(before.cards);
        expect(row.history).toEqual(before.history);
        expect(row.extended_data.legacyBackup.row.cards).toEqual(before.cards);
        expect(list(row.extended_data.doc, 'accounts').map((a) => a.name).sort()).toEqual(['EUR cash', 'Ziraat', 'Ziraat account']);
        expect(list(row.extended_data.doc, 'snapshots')).toHaveLength(0);
        expect(store.getState().dirty).toBe(false);
        expect(JSON.parse(window.localStorage.getItem('pv5-legacy-backup:user-1')).row.cards).toEqual(before.cards);
        store.stop();
    });

    it('creates a row for a brand-new account', async () => {
        await store.start(session);
        expect(db.row.extended_data.version).toBe(5);
        store.stop();
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
