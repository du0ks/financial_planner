// The whole of one user's data is a single document of record collections. Every record has
// an `id`, an `updatedAt` stamp and, once deleted, `deleted: true` (a tombstone that stays so
// the deletion can win a merge against a device that still has the record).
//
// That shape is what makes sync safe: two copies of the document merge record by record,
// newest stamp wins, so a phone adding an expense and a laptop editing a card never
// overwrite each other. See merge() and lib/sync.js.

export const SCHEMA_VERSION = 5;

export const COLLECTIONS = [
    'settings',   // { id: key, value }
    'accounts',   // bank / cash / ewallet / investment / credit
    'anchors',    // a balance you typed in: { accountId, amount, date, setAt }
    'tx',         // expense / income / transfer
    'rules',      // recurring income and bills
    'categories',
    'budgets',    // { categoryId, amount, currency }
    'planned',    // planned purchases
    'portions',   // named gold portions
    'goldEvents', // buy / sell / move / adjust, in milligrams
    'snapshots',
    'goals',
    'fxDays',     // frozen rates per date: { id: 'YYYY-MM-DD', rates, overrides }
];

export function emptyDoc() {
    const doc = { schema: SCHEMA_VERSION };
    for (const name of COLLECTIONS) doc[name] = {};
    return doc;
}

export function isDoc(value) {
    return Boolean(value && typeof value === 'object' && value.schema === SCHEMA_VERSION);
}

/** Fills in any collection a document from an older build is missing. */
export function normalizeDoc(value) {
    const doc = emptyDoc();
    if (!value || typeof value !== 'object') return doc;
    for (const name of COLLECTIONS) {
        const source = value[name];
        if (source && typeof source === 'object') doc[name] = { ...source };
    }
    return doc;
}

let lastStamp = 0;
/** Strictly increasing on this device, so two edits in one millisecond still order. */
export function stamp() {
    const now = Date.now();
    lastStamp = now > lastStamp ? now : lastStamp + 1;
    return lastStamp;
}

export function newId(prefix = '') {
    const random = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    return prefix ? `${prefix}_${random}` : random;
}

const newer = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    if ((a.updatedAt || 0) !== (b.updatedAt || 0)) return (a.updatedAt || 0) > (b.updatedAt || 0) ? a : b;
    // Same stamp from two devices: pick deterministically so both sides converge.
    return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
};

/** Record-level merge, newest stamp wins. Commutative and idempotent. */
export function merge(a, b) {
    const left = normalizeDoc(a);
    const right = normalizeDoc(b);
    const out = emptyDoc();
    for (const name of COLLECTIONS) {
        const ids = new Set([...Object.keys(left[name]), ...Object.keys(right[name])]);
        for (const id of ids) out[name][id] = newer(left[name][id], right[name][id]);
    }
    return out;
}

export function sameDoc(a, b) {
    return JSON.stringify(normalizeDoc(a)) === JSON.stringify(normalizeDoc(b));
}

/** Live (not deleted) records of a collection, as an array. */
export function list(doc, name) {
    return Object.values(doc?.[name] || {}).filter((record) => record && !record.deleted);
}

export function get(doc, name, id) {
    const record = doc?.[name]?.[id];
    return record && !record.deleted ? record : null;
}

/** Returns a new document with `record` written (created or replaced) and stamped. */
export function put(doc, name, record, at = stamp()) {
    const id = record.id || newId();
    const previous = doc[name]?.[id];
    const next = {
        ...record,
        id,
        createdAt: record.createdAt || previous?.createdAt || at,
        updatedAt: at,
    };
    delete next.deleted;
    return { ...doc, [name]: { ...doc[name], [id]: next } };
}

/** Returns a new document with the record replaced by a tombstone. */
export function remove(doc, name, id, at = stamp()) {
    if (!doc[name]?.[id]) return doc;
    return { ...doc, [name]: { ...doc[name], [id]: { id, deleted: true, updatedAt: at } } };
}

export function getSetting(doc, key, fallback) {
    const record = get(doc, 'settings', key);
    return record && record.value !== undefined ? record.value : fallback;
}

export function putSetting(doc, key, value, at) {
    return put(doc, 'settings', { id: key, value }, at);
}

/**
 * A restore replaces everything: every record the current document has is tombstoned and
 * the restored records are written fresh, so another device holding the old data can't
 * merge it back in.
 */
export function replaceAll(current, incoming, at = stamp()) {
    let doc = normalizeDoc(current);
    for (const name of COLLECTIONS) {
        for (const id of Object.keys(doc[name])) doc = remove(doc, name, id, at);
    }
    const source = normalizeDoc(incoming);
    for (const name of COLLECTIONS) {
        for (const record of Object.values(source[name])) {
            if (record && !record.deleted) doc = put(doc, name, { ...record, createdAt: record.createdAt || at }, at + 1);
        }
    }
    return doc;
}
