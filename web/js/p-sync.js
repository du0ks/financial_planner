/*
 * p-sync.js — Merging two copies of the notebook (pure; tested by Node). Each device keeps the copy it last saved to
 * the cloud (the base). When the cloud has moved on, the two are merged record by record against that base:
 *   changed on one side only            → that side's version
 *   added on either side                → kept
 *   deleted on one side, untouched on the other → deleted
 *   deleted on one side, edited on the other    → the edit is kept (nothing is lost silently)
 *   changed on both sides, differently  → this device's version
 */
"use strict";

const P_LISTS = ["accounts", "types", "cats", "txns", "loans", "assets", "rules", "skips"];
const P_MAPS = ["settings", "budgets", "fxDays"];
const pSkipKey = k => k.rule + "|" + k.month;
const pKeyOf = (name, x) => (name === "skips" ? pSkipKey(x) : x && x.id);
const pSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* one value: a, b, c are base, local, remote (undefined = absent) */
function pPick(base, local, remote) {
  const inB = base !== undefined,
    inL = local !== undefined,
    inR = remote !== undefined;
  if (inL && inR) {
    if (pSame(local, remote) || pSame(remote, base)) return { v: local };
    if (pSame(local, base)) return { v: remote };
    return { v: local };
  }
  if (inL) return !inB || !pSame(local, base) ? { v: local } : null; // remote deleted it: unless edited here, it goes
  if (inR) return !inB || !pSame(remote, base) ? { v: remote } : null;
  return null;
}
function pMergeList(name, base, local, remote) {
  const idx = list => new Map((list || []).map(x => [pKeyOf(name, x), x]));
  const B = idx(base),
    L = idx(local),
    R = idx(remote),
    out = [],
    seen = new Set();
  /* this device's order first, then what only the other side has, where it had it */
  [...(local || []), ...(remote || [])].forEach(x => {
    const k = pKeyOf(name, x);
    if (seen.has(k)) return;
    seen.add(k);
    const p = pPick(B.get(k), L.get(k), R.get(k));
    if (p) out.push(p.v);
  });
  return out;
}
function pMergeMap(base, local, remote) {
  const out = {},
    keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  keys.forEach(k => {
    const p = pPick((base || {})[k], (local || {})[k], (remote || {})[k]);
    if (p) out[k] = p.v;
  });
  return out;
}
/* the merged notebook; base may be null (first time: union, this device winning) */
function pMerge(base, local, remote) {
  const b = base || {},
    out = Object.assign({}, remote, local);
  P_LISTS.forEach(n => (out[n] = pMergeList(n, b[n], local[n], remote[n])));
  P_MAPS.forEach(n => (out[n] = pMergeMap(b[n], local[n], remote[n])));
  return out;
}
