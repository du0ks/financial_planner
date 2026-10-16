import { emptyDoc, isDoc, merge, normalizeDoc, replaceAll, sameDoc, SCHEMA_VERSION } from '../lib/doc';
import { withDefaults } from '../lib/defaults';
import { migrateLegacy } from '../lib/migrate';
import { buildDemoDoc } from '../lib/demo';
import { supabase } from './supabase';

// One store per signed-in user. The document lives in this browser first (localStorage), so
// the app opens instantly and keeps working offline; changes are pushed to the cloud row in
// the background.
//
// Conflict safety: a push is a compare-and-swap on the row's `updated_at`. It only lands if
// the row is still the version this browser last saw. If another device saved in between,
// the push matches no row, this browser fetches the newer row, merges record by record
// (lib/doc.js merge), and pushes the merge. A stale tab can therefore never overwrite newer
// data — it can only add to it.
//
// The v5 document is stored in the row's `extended_data` jsonb as { version: 5, doc }. The
// legacy columns (cards, funds, others, history, gold_grams) are never written again, so they
// stay as an untouched copy of the data from before the upgrade.

const LOCAL_PREFIX = 'pv5:';
const LEGACY_BACKUP_PREFIX = 'pv5-legacy-backup:';
const PUSH_DELAY = 700;
const POLL_INTERVAL = 60 * 1000;
const RETRY_INTERVAL = 20 * 1000;

const listeners = new Set();
let state = initialState();
let timers = { push: null, poll: null, retry: null };
let pushing = false;
let version = 0;

function initialState() {
    return {
        key: null,
        ready: false,
        doc: emptyDoc(),
        baseRev: null,
        dirty: false,
        sync: { state: 'idle', error: null, lastSyncedAt: null },
        bootError: null,
    };
}

function emit(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
}

export const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
export const getState = () => state;

const setSync = (patch) => emit({ sync: { ...state.sync, ...patch } });

function readLocal(key) {
    try {
        const raw = window.localStorage.getItem(LOCAL_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return isDoc(parsed?.doc) ? parsed : null;
    } catch {
        return null;
    }
}

function writeLocal() {
    if (!state.key) return;
    try {
        window.localStorage.setItem(LOCAL_PREFIX + state.key, JSON.stringify({
            doc: state.doc,
            baseRev: state.baseRev,
            dirty: state.dirty,
            savedAt: Date.now(),
        }));
    } catch (error) {
        console.error('Could not save on this device', error);
    }
}

/** The pre-v5 data this browser kept in localStorage, if any, with its last-edit stamp. */
function readLegacyLocal() {
    try {
        const get = (name) => {
            const raw = window.localStorage.getItem(`finance_${name}`);
            return raw ? JSON.parse(raw) : undefined;
        };
        const cards = get('cards_v3');
        if (!cards) return null;
        return {
            touchedAt: Number(window.localStorage.getItem('finance_touched_at_v1')) || 0,
            data: {
                cards,
                funds: get('funds_v3'),
                others: get('others_v3'),
                currency: get('currency_v3'),
                history: get('history_v3'),
                investments: get('investments_v3'),
                incomes: get('incomes_v3'),
                goldGrams: get('gold_v3'),
            },
        };
    } catch {
        return null;
    }
}

function rowToLegacy(row) {
    const extended = row.extended_data || {};
    return {
        cards: row.cards,
        funds: row.funds,
        others: row.others,
        currency: row.currency,
        history: row.history,
        goldGrams: row.gold_grams,
        investments: extended.investments,
        incomes: extended.incomes,
    };
}

const rowDoc = (row) => (row?.extended_data?.version === SCHEMA_VERSION && isDoc(row.extended_data.doc) ? normalizeDoc(row.extended_data.doc) : null);

// ---------------------------------------------------------------------------------------------

export async function start(session) {
    stop();
    if (!session) return;
    const isDemo = Boolean(session.isDemo);
    const key = isDemo ? 'demo' : session.user.id;
    const local = readLocal(key);

    if (isDemo) {
        emit({ ...initialState(), key, ready: true, doc: local?.doc || buildDemoDoc() });
        writeLocal();
        return;
    }

    emit({
        ...initialState(),
        key,
        ready: Boolean(local),
        doc: local?.doc || emptyDoc(),
        baseRev: local?.baseRev || null,
        dirty: Boolean(local?.dirty),
        sync: { state: 'loading', error: null, lastSyncedAt: null },
    });

    await hydrate(session.user.id, local);
    timers.poll = window.setInterval(() => pull(), POLL_INTERVAL);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
}

export function stop() {
    window.clearTimeout(timers.push);
    window.clearInterval(timers.poll);
    window.clearInterval(timers.retry);
    timers = { push: null, poll: null, retry: null };
    window.removeEventListener('online', onWake);
    document.removeEventListener('visibilitychange', onWake);
    state = initialState();
}

function onWake() {
    if (document.visibilityState === 'hidden') {
        // Leaving the app: get pending edits out now rather than after the debounce.
        if (state.dirty) push();
        return;
    }
    pull();
}

async function fetchRow(userId) {
    return supabase.from('user_data').select('*').eq('user_id', userId).maybeSingle();
}

async function hydrate(userId, local) {
    const { data: row, error } = await fetchRow(userId);
    if (error) {
        if (local) {
            emit({ ready: true });
            setSync({ state: 'offline', error: error.message });
            scheduleRetry();
        } else {
            emit({ bootError: error.message || 'Could not reach the cloud' });
            setSync({ state: 'error', error: error.message });
        }
        return;
    }

    const at = Date.now();
    if (!row) {
        // First time in the cloud for this account.
        let doc = local?.doc;
        if (!doc) {
            const legacy = readLegacyLocal();
            doc = legacy ? migrateLegacy(legacy.data, { at }) : withDefaults(emptyDoc(), { displayCurrency: 'EUR', at });
        }
        emit({ ready: true, doc, baseRev: null, dirty: true });
        writeLocal();
        await push();
        return;
    }

    const remote = rowDoc(row);
    if (remote) {
        const merged = local ? merge(local.doc, remote) : remote;
        emit({ ready: true, doc: merged, baseRev: row.updated_at, dirty: !sameDoc(merged, remote) });
        writeLocal();
        setSync({ state: 'ready', error: null, lastSyncedAt: Date.now() });
        if (state.dirty) schedulePush(0);
        return;
    }

    // The row holds pre-v5 data.
    if (local?.baseRev) {
        // This browser already synced a v5 document, so the row was overwritten by a tab still
        // running the old app. Keep the v5 data and put it back.
        emit({ ready: true, baseRev: row.updated_at, dirty: true });
        writeLocal();
        await push();
        return;
    }

    // Upgrade. Prefer this browser's copy if it holds edits newer than the cloud row.
    const legacyLocal = readLegacyLocal();
    const rowTime = Date.parse(row.updated_at) || 0;
    const source = legacyLocal && legacyLocal.touchedAt > rowTime ? legacyLocal.data : rowToLegacy(row);
    const migrated = migrateLegacy(source, { at: rowTime || at });
    const doc = local?.doc ? merge(local.doc, migrated) : migrated;
    const backup = { row, localLegacy: legacyLocal?.data || null, savedAt: new Date().toISOString() };
    try {
        window.localStorage.setItem(LEGACY_BACKUP_PREFIX + userId, JSON.stringify(backup));
    } catch (storageError) {
        console.error(storageError);
    }
    emit({ ready: true, doc, baseRev: row.updated_at, dirty: true, legacyBackup: backup });
    writeLocal();
    await push({ legacyBackup: backup });
}

function scheduleRetry() {
    if (timers.retry) return;
    timers.retry = window.setInterval(() => {
        if (state.dirty) push();
        else pull();
    }, RETRY_INTERVAL);
}

function clearRetry() {
    window.clearInterval(timers.retry);
    timers.retry = null;
}

function schedulePush(delay = PUSH_DELAY) {
    window.clearTimeout(timers.push);
    timers.push = window.setTimeout(() => push(), delay);
}

async function push(extra = {}) {
    if (!state.key || state.key === 'demo' || !state.dirty || pushing) return;
    pushing = true;
    const userId = state.key;
    try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const sentVersion = version;
            const doc = state.doc;
            const nextRev = new Date().toISOString();
            setSync({ state: 'saving' });

            let result;
            if (state.baseRev === null) {
                result = await supabase.from('user_data').insert({
                    user_id: userId,
                    cards: [], funds: [], others: [], history: [], gold_grams: 0,
                    currency: doc.settings?.displayCurrency?.value || 'EUR',
                    extended_data: { version: SCHEMA_VERSION, doc, ...extra },
                    updated_at: nextRev,
                }).select('updated_at');
                if (result.error?.code === '23505') result = { data: [], error: null }; // created meanwhile
            } else {
                const extended = { version: SCHEMA_VERSION, doc };
                const backup = extra.legacyBackup || state.legacyBackup;
                if (backup) extended.legacyBackup = backup;
                result = await supabase.from('user_data')
                    .update({ extended_data: extended, updated_at: nextRev })
                    .eq('user_id', userId)
                    .eq('updated_at', state.baseRev)
                    .select('updated_at');
            }

            if (result.error) throw result.error;

            if (result.data && result.data.length === 1) {
                emit({ baseRev: result.data[0].updated_at, dirty: version !== sentVersion });
                writeLocal();
                clearRetry();
                setSync({ state: 'ready', error: null, lastSyncedAt: Date.now() });
                if (state.dirty) continue;
                return;
            }

            // Someone else saved first: take their version, merge, try again.
            const { data: row, error } = await fetchRow(userId);
            if (error) throw error;
            const remote = rowDoc(row);
            const merged = remote ? merge(state.doc, remote) : state.doc;
            emit({ doc: merged, baseRev: row ? row.updated_at : null, dirty: true });
            writeLocal();
        }
        throw new Error('Could not settle a save conflict, will retry');
    } catch (error) {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setSync({ state: offline ? 'offline' : 'error', error: error.message || String(error) });
        scheduleRetry();
    } finally {
        pushing = false;
    }
}

async function pull() {
    if (!state.key || state.key === 'demo' || pushing) return;
    const userId = state.key;
    const { data: head, error } = await supabase.from('user_data').select('updated_at').eq('user_id', userId).maybeSingle();
    if (error) {
        setSync({ state: navigator.onLine === false ? 'offline' : 'error', error: error.message });
        scheduleRetry();
        return;
    }
    if (head && head.updated_at === state.baseRev) {
        if (state.dirty) push();
        else setSync({ state: 'ready', error: null, lastSyncedAt: Date.now() });
        return;
    }
    const { data: row, error: rowError } = await fetchRow(userId);
    if (rowError || !row) return;
    const remote = rowDoc(row);
    if (!remote) {
        // Overwritten by an old-version tab: restore ours.
        emit({ baseRev: row.updated_at, dirty: true });
        writeLocal();
        push();
        return;
    }
    const merged = merge(state.doc, remote);
    emit({ doc: merged, baseRev: row.updated_at, dirty: state.dirty || !sameDoc(merged, remote) });
    writeLocal();
    setSync({ state: 'ready', error: null, lastSyncedAt: Date.now() });
    if (state.dirty) push();
}

// ---------------------------------------------------------------------------------------------

/** Applies an edit: fn(doc) → doc. Saved on this device at once, sent to the cloud shortly after. */
export function update(fn) {
    const next = fn(state.doc);
    if (!next || next === state.doc) return;
    version += 1;
    emit({ doc: next, dirty: true });
    writeLocal();
    if (state.key !== 'demo') schedulePush();
}

export function restore(incoming) {
    update((doc) => replaceAll(doc, incoming));
}

export function syncNow() {
    if (state.dirty) push();
    else pull();
}

export function legacyBackupFor(userId) {
    try {
        const raw = window.localStorage.getItem(LEGACY_BACKUP_PREFIX + userId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function resetDemo() {
    try {
        window.localStorage.removeItem(`${LOCAL_PREFIX}demo`);
    } catch {
        // ignore
    }
}
