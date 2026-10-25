/*
 * p-cloud.js — Your account and your data in the cloud (Supabase), without any library: sign in / create an account
 * / reset the password, keep each person's notebook apart on the device, save every change to the cloud (queued
 * while offline), merge when two devices changed it (p-sync.js), and bring data back from the previous app the first
 * time (p-import.js).
 *
 * The cloud row: public.app_state (user_id, data, rev). Every save is "write if the row is still at the revision this
 * device last saw": if another device saved first, the two are merged and saved again.
 */
"use strict";

const P_API_ = window.PROSPERITY_API;
const P_SESSION_KEY = "prosperity:session";
const P_SYNC = { state: "idle", at: 0, dirty: false, pushing: false, timer: null, error: "" };

/* ---------- session ---------- */

function pSession() {
  try {
    return JSON.parse(localStorage.getItem(P_SESSION_KEY) || "null");
  } catch (e) {
    return null;
  }
}
function pSetSession(s) {
  try {
    if (s) localStorage.setItem(P_SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(P_SESSION_KEY);
  } catch (e) {}
}
const pUser = () => {
  const s = pSession();
  return s && s.user ? s.user : null;
};
const pIsDemo = () => !!(pSession() || {}).demo;
const pSignedIn = () => !!pUser() || pIsDemo();
/* the notebook of whoever is signed in, from this device: switches LS and loads it (a blank one if none) */
function pUseNotebook() {
  const u = pUser();
  LS = u ? "prosperity:v1:" + u.id : pIsDemo() ? "prosperity:v1:demo" : "prosperity:v1:none";
  S = blank();
  saveSeq = 0;
  loadState();
  PM = null;
  P_SYNC.dirty = (() => {
    try {
      return localStorage.getItem(LS + ":dirty") === "1";
    } catch (e) {
      return false;
    }
  })();
}
const pBase = () => {
  try {
    return JSON.parse(localStorage.getItem(LS + ":base") || "null");
  } catch (e) {
    return null;
  }
};
const pSetBase = b => {
  try {
    localStorage.setItem(LS + ":base", JSON.stringify(b));
  } catch (e) {}
};
const pSetDirty = on => {
  P_SYNC.dirty = on;
  try {
    if (on) localStorage.setItem(LS + ":dirty", "1");
    else localStorage.removeItem(LS + ":dirty");
  } catch (e) {}
};

/* ---------- talking to Supabase ---------- */

const P_AUTH_ERRORS = {
  invalid_credentials: "Wrong email or password.",
  email_not_confirmed: "Confirm your email first: open the link we sent you.",
  user_already_exists: "There is already an account with this email. Sign in instead.",
  weak_password: "Choose a longer password (at least 8 characters).",
  over_email_send_rate_limit: "Too many emails just now. Try again in a minute.",
};
async function pAuthCall(path, body, opts = {}) {
  let r;
  try {
    r = await fetch(P_API_.url + "/auth/v1/" + path, {
      method: opts.method || "POST",
      headers: { apikey: P_API_.key, "Content-Type": "application/json", Authorization: "Bearer " + (opts.token || P_API_.key) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error("No connection. Check your internet and try again.");
    err.offline = true;
    throw err;
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = j.error_code || j.code || j.error;
    throw new Error(P_AUTH_ERRORS[code] || j.msg || j.error_description || j.message || "Something went wrong (" + r.status + ").");
  }
  return j;
}
const pKeep = j => ({
  access_token: j.access_token,
  refresh_token: j.refresh_token,
  expires_at: Date.now() + (j.expires_in || 3600) * 1000,
  user: { id: j.user.id, email: j.user.email },
});
/* a valid access token, refreshed shortly before it runs out; null when signed out. A refresh token works once, so
   calls arriving together share one refresh. */
let pRefreshing = null;
function pToken(force) {
  const s = pSession();
  if (!s || !s.refresh_token) return Promise.resolve(null);
  if (!force && s.expires_at - Date.now() > 60 * 1000) return Promise.resolve(s.access_token);
  if (!pRefreshing) pRefreshing = pRefresh(s).finally(() => (pRefreshing = null));
  return pRefreshing;
}
async function pRefresh(s) {
  try {
    const j = await pAuthCall("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    const next = pKeep(j);
    pSetSession(next);
    return next.access_token;
  } catch (e) {
    if (e.offline) throw e;
    /* the session ended (signed out elsewhere, or expired long ago): back to the sign-in page, data kept */
    pSetSession(null);
    pUseNotebook();
    render();
    snack("Please sign in again");
    return null;
  }
}
/* fetch, with a lost connection marked as such (it says "offline", not "error") */
async function pFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    const err = new Error("No connection");
    err.offline = true;
    throw err;
  }
}
async function pRest(method, path, body, prefer) {
  for (let i = 0; i < 2; i++) {
    const token = await pToken(i > 0);
    if (!token) throw new Error("signed out");
    const r = await pFetch(P_API_.url + "/rest/v1/" + path, {
      method,
      headers: Object.assign(
        { apikey: P_API_.key, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        prefer ? { Prefer: prefer } : {}
      ),
      body: body ? JSON.stringify(body) : undefined,
      keepalive: method !== "GET" && JSON.stringify(body || "").length < 60000,
    });
    if (r.status === 401 && i === 0) continue;
    const text = await r.text();
    const j = text ? JSON.parse(text) : null;
    if (!r.ok) {
      const err = new Error((j && (j.message || j.hint)) || "HTTP " + r.status);
      err.status = r.status;
      err.code = j && j.code;
      throw err;
    }
    return j;
  }
}
const pRow = async () => {
  const rows = await pRest("GET", "app_state?select=data,rev&user_id=eq." + pUser().id);
  return rows && rows[0] ? rows[0] : null;
};

/* ---------- saving to the cloud ---------- */

function pSyncState(state, error) {
  P_SYNC.state = state;
  if (state === "saved") P_SYNC.at = Date.now();
  P_SYNC.error = error || "";
  const el = document.querySelector(".p-sync");
  if (el) el.outerHTML = pSyncBadge();
}
/* every local save marks the notebook to go up; a burst of changes goes in one save */
const tallySaveLocal = save;
save = function () {
  tallySaveLocal();
  if (!pUser()) return;
  pSetDirty(true);
  clearTimeout(P_SYNC.timer);
  P_SYNC.timer = setTimeout(pPush, 1200);
};
/* this notebook after a merge: kept on the device without marking it for another upload by itself */
function pAdopt(data) {
  S = migrate(data);
  tallySaveLocal();
  PM = null;
  if (!$("#sheet").innerHTML) render();
}
async function pPush() {
  if (!pUser() || P_SYNC.pushing || !P_SYNC.dirty) return;
  P_SYNC.pushing = true;
  pSyncState("saving");
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const sent = JSON.stringify(S),
        data = JSON.parse(sent),
        base = pBase();
      let rows;
      if (!base) {
        try {
          rows = await pRest("POST", "app_state", { user_id: pUser().id, data, rev: 1 }, "return=representation");
        } catch (e) {
          if (e.status !== 409) throw e; // the row exists already (made on another device): merge below
          rows = [];
        }
      } else rows = await pRest("PATCH", "app_state?user_id=eq." + pUser().id + "&rev=eq." + base.rev, { data, rev: base.rev + 1, updated_at: new Date().toISOString() }, "return=representation");
      if (rows && rows.length) {
        pSetBase({ rev: rows[0].rev, data });
        if (JSON.stringify(S) === sent) pSetDirty(false); // else a change came in meanwhile: it goes next
        pSyncState("saved");
        break;
      }
      /* another device saved first: merge both into this one, and try again on top of theirs */
      const remote = await pRow();
      if (!remote) {
        pSetBase(null);
        continue;
      }
      pAdopt(pMerge(base && base.data, JSON.parse(sent), remote.data));
      pSetBase({ rev: remote.rev, data: remote.data });
    }
  } catch (e) {
    if (e.message === "signed out") return;
    pSyncState(e.offline || navigator.onLine === false ? "offline" : "error", e.message);
  } finally {
    P_SYNC.pushing = false;
  }
  if (P_SYNC.dirty && P_SYNC.state === "saved") setTimeout(pPush, 300);
}
/* what other devices saved: taken in when it moved on (merged with anything not yet sent from here) */
async function pPull() {
  if (!pUser() || P_SYNC.pushing) return;
  try {
    const head = await pRest("GET", "app_state?select=rev&user_id=eq." + pUser().id),
      base = pBase();
    if (!head || !head.length) return;
    if (base && head[0].rev === base.rev) {
      if (P_SYNC.dirty) pPush();
      else pSyncState("saved");
      return;
    }
    const remote = await pRow();
    if (!remote) return;
    if (P_SYNC.dirty) {
      pAdopt(pMerge(base && base.data, S, remote.data));
      pSetBase({ rev: remote.rev, data: remote.data });
      pPush();
    } else {
      pAdopt(remote.data);
      pSetBase({ rev: remote.rev, data: remote.data });
      pSyncState("saved");
    }
  } catch (e) {
    if (e.message !== "signed out") pSyncState(e.offline || navigator.onLine === false ? "offline" : "error", e.message);
  }
}

/* ---------- the first time on a device, and bringing back the old app's data ---------- */

async function pFirstSync() {
  if (!pUser()) return;
  pSyncState("saving");
  let row;
  try {
    row = await pRow();
  } catch (e) {
    if (e.message === "signed out") return;
    if (e.code === "42P01" || e.status === 404) return pSyncState("error", "The cloud isn't set up yet (app_state table missing).");
    return pSyncState("offline", e.message);
  }
  if (row) {
    const base = pBase();
    if (base && base.rev === row.rev) {
      if (P_SYNC.dirty) pPush();
      else pSyncState("saved");
      return;
    }
    const merged = S.accounts.length || P_SYNC.dirty ? pMerge(base && base.data, S, row.data) : row.data;
    pAdopt(merged);
    pSetBase({ rev: row.rev, data: row.data });
    if (JSON.stringify(S) !== JSON.stringify(migrate(row.data))) {
      pSetDirty(true);
      pPush();
    } else pSyncState("saved");
    return;
  }
  /* nothing in the cloud yet: what this device has goes up; else maybe the previous app has something */
  if (S.accounts.length) {
    pSetDirty(true);
    return pPush();
  }
  pSyncState("saved");
  const old = await pOldData();
  if (old) pImportSheet(old);
}
/* the previous app's notebook, converted, or null */
async function pOldData() {
  try {
    const rows = await pRest("GET", "user_data?select=extended_data&user_id=eq." + pUser().id);
    const ext = rows && rows[0] && rows[0].extended_data;
    if (!ext || ext.version !== 5 || !ext.doc) return null;
    const r = pFromV5(ext.doc, { latest: pRates() || {}, today: today() });
    return r.state.accounts.length ? r : null;
  } catch (e) {
    return null;
  }
}
function pImportSheet(r, replacing) {
  const rep = r.report;
  F = { kind: "pimport" };
  P_IMPORT = r;
  openSheet(
    "Your data from the old app",
    '<p class="muted small" style="margin:0 0 10px">Found in your account. It comes over with every balance exactly as before:</p>' +
      '<div class="list">' +
      rep.accounts
        .map(
          a =>
            '<div class="tx"><span class="mid"><div class="d">' +
            esc(a.name) +
            '</div></span><span class="a' +
            (a.same ? "" : " p-debt") +
            '">' +
            esc(money(a.after, a.currency)) +
            (a.same ? "" : "<small>was " + esc(money(a.before, a.currency)) + "</small>") +
            "</span></div>"
        )
        .join("") +
      "</div>" +
      '<p class="hint">' +
      esc(
        rep.counts.entries + " entries · " + rep.counts.rules + " recurring · " + rep.counts.budgets + " budgets" + (rep.counts.gold ? " · gold" : "") + "."
      ) +
      (rep.loans.length ? "<br>" + esc("Someone else paid, so it comes over as a loan: " + rep.loans.join(", ") + ". If they won't ask for it back, open the loan and forgive it.") : "") +
      (rep.left.length ? "<br>" + esc("Not in this app, so left out: " + rep.left.join(", ") + ".") : "") +
      (rep.skipped.length ? "<br>" + esc("Skipped: " + rep.skipped.join("; ") + ".") : "") +
      '</p><div class="gap"></div><button class="btn" data-act="p-import-ok">' +
      ic("check") +
      (replacing ? "Replace what's here with it" : "Bring it back") +
      '</button><div class="gap"></div><button class="btn text" data-act="close">' +
      (replacing ? "Cancel" : "Start fresh instead") +
      "</button>"
  );
}
let P_IMPORT = null;
function pImportApply() {
  if (!P_IMPORT) return;
  const state = P_IMPORT.state;
  P_IMPORT = null;
  closeSheet();
  S = migrate(state);
  PM = null;
  V.screen = "home";
  commit();
  snack("Your data is back");
}

/* ---------- signing in and out ---------- */

const P_HERE = () => location.origin + location.pathname;
let P_AUTH = { mode: "in", msg: "", err: false, busy: false };
function pAuthView() {
  const up = P_AUTH.mode === "up",
    reset = P_AUTH.mode === "reset";
  return (
    '<header class="appbar"><h1>Prosperity</h1></header>' +
    '<div class="welcome p-auth"><img class="logo" src="icon-512.png" alt=""><h2>' +
    (up ? "Create your account" : reset ? "Reset your password" : "Welcome back") +
    "</h2><p>" +
    (up
      ? "Your money across accounts, currencies and gold, on every device you sign in on."
      : reset
        ? "We'll email you a link to set a new password."
        : "Sign in to see your money on this device.") +
    "</p>" +
    '<label class="field"><span>Email</span><input id="p-email" type="email" autocomplete="email" inputmode="email" value="' +
    esc(P_AUTH.email || "") +
    '"></label>' +
    (reset
      ? ""
      : '<label class="field"><span>Password</span><input id="p-pass" type="password" autocomplete="' +
        (up ? "new-password" : "current-password") +
        '"></label>') +
    (P_AUTH.msg ? '<p class="hint' + (P_AUTH.err ? " p-warn" : "") + '" role="status">' + esc(P_AUTH.msg) + "</p>" : "") +
    '<button class="btn" data-act="p-auth-go"' +
    (P_AUTH.busy ? " disabled" : "") +
    ">" +
    (up ? "Create account" : reset ? "Send the link" : "Sign in") +
    "</button>" +
    '<div class="row p-auth-links">' +
    (up || reset
      ? '<button class="btn text" data-act="p-auth-mode" data-v="in">I have an account</button>'
      : '<button class="btn text" data-act="p-auth-mode" data-v="up">Create an account</button><button class="btn text" data-act="p-auth-mode" data-v="reset">Forgot password?</button>') +
    "</div>" +
    '<div class="gap"></div><button class="btn tonal" data-act="p-demo">Try it with sample data</button>' +
    "</div>"
  );
}
async function pAuthGo() {
  const email = ($("#p-email") || {}).value.trim(),
    pass = ($("#p-pass") || {}).value || "";
  P_AUTH.email = email;
  if (!/^\S+@\S+\.\S+$/.test(email)) return pAuthMsg("Enter your email address.", true);
  if (P_AUTH.mode !== "reset" && pass.length < (P_AUTH.mode === "up" ? 8 : 1)) return pAuthMsg(P_AUTH.mode === "up" ? "Choose a password of at least 8 characters." : "Enter your password.", true);
  P_AUTH.busy = true;
  render();
  try {
    if (P_AUTH.mode === "reset") {
      await pAuthCall("recover?redirect_to=" + encodeURIComponent(P_HERE()), { email });
      P_AUTH.mode = "in";
      pAuthMsg("If there's an account for " + email + ", a link to set a new password is on its way.");
    } else if (P_AUTH.mode === "up") {
      const j = await pAuthCall("signup?redirect_to=" + encodeURIComponent(P_HERE()), { email, password: pass });
      if (j.access_token) return pSignedInAs(j);
      P_AUTH.mode = "in";
      pAuthMsg("Almost there: open the link we sent to " + email + " to confirm it's you, then sign in.");
    } else pSignedInAs(await pAuthCall("token?grant_type=password", { email, password: pass }));
  } catch (e) {
    pAuthMsg(e.message, true);
  } finally {
    P_AUTH.busy = false;
    render();
  }
}
function pAuthMsg(msg, err) {
  P_AUTH.msg = msg;
  P_AUTH.err = !!err;
  render();
}
function pSignedInAs(j) {
  pSetSession(pKeep(j));
  P_AUTH = { mode: "in", msg: "", err: false, busy: false };
  pUseNotebook();
  V.screen = "home";
  render();
  pFirstSync();
}
/* the links in our emails come back with a session in the address: confirm the email, or set a new password */
async function pFromEmailLink() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.get("access_token") && !h.get("error")) return false;
  history.replaceState(null, "", location.pathname + location.search);
  if (h.get("error")) {
    P_AUTH.msg = h.get("error_description") || "That link has expired. Ask for a new one.";
    P_AUTH.err = true;
    return true;
  }
  try {
    const user = await pAuthCall("user", null, { method: "GET", token: h.get("access_token") });
    pSignedInAs({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_in: +h.get("expires_in") || 3600, user });
    if (h.get("type") === "recovery") pNewPasswordSheet();
    else if (h.get("type") === "signup") snack("Your email is confirmed. Welcome!");
  } catch (e) {
    P_AUTH.msg = e.message;
    P_AUTH.err = true;
  }
  return true;
}
function pNewPasswordSheet() {
  F = { kind: "ppass" };
  openSheet(
    "Set a new password",
    '<label class="field"><span>New password</span><input id="p-newpass" type="password" autocomplete="new-password"></label><div class="gap"></div><button class="btn" data-act="p-pass-save">Save password</button>'
  );
}
async function pPassSave() {
  const p = ($("#p-newpass") || {}).value || "";
  if (p.length < 8) return snack("At least 8 characters");
  try {
    await pAuthCall("user", { password: p }, { method: "PUT", token: await pToken() });
    closeSheet();
    snack("Password changed");
  } catch (e) {
    snack(e.message);
  }
}
function pSignOut() {
  const go = async () => {
    const token = pSession() && pSession().access_token;
    if (token) pAuthCall("logout", null, { token }).catch(() => {});
    /* this device forgets the notebook (a shared computer shouldn't keep it); it's in the cloud */
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    pSetSession(null);
    pUseNotebook();
    V.screen = "home";
    closeSheet();
    render();
    scrollTo(0, 0);
  };
  if (pIsDemo()) return go();
  if (P_SYNC.dirty)
    askDialog("Not saved to the cloud yet", "Some changes haven't reached your account (no connection?). Signing out now loses them.", "Sign out anyway", go, { danger: true });
  else go();
}

/* ---------- on screen ---------- */

function pSyncBadge() {
  if (pIsDemo()) return '<span class="p-sync demo">Sample · not saved</span>';
  if (!pUser()) return '<span class="p-sync"></span>';
  const s = P_SYNC.state,
    text =
      s === "saving"
        ? "Saving…"
        : s === "offline"
          ? "Offline · saved on this device"
          : s === "error"
            ? "Not saved: " + P_SYNC.error
            : P_SYNC.dirty
              ? "Waiting to save"
              : "Saved";
  return '<span class="p-sync ' + s + '" role="status" title="' + esc(text) + '">' + esc(text) + "</span>";
}
/* signed out: the sign-in page instead of Home */
const tallyHomeViewC = homeView;
homeView = function () {
  if (!pSignedIn()) return pAuthView();
  return tallyHomeViewC();
};
/* Settings: who you are, how saving is going, the old app's data, and signing out */
const tallySettingsViewC = settingsView;
settingsView = function () {
  const h = tallySettingsViewC(),
    i = h.indexOf("</header>") + "</header>".length,
    u = pUser();
  const mine = pIsDemo()
    ? pSecHead("Sample data", null) +
      '<div class="list"><div class="setrow"><span class="mid"><div>Nothing here is saved</div><div class="s">Sign in or create an account to use your own</div></span><button class="btn tonal" data-act="p-signout">Leave the sample</button></div></div>'
    : u
      ? pSecHead("Account", null) +
        '<div class="list"><div class="setrow"><span class="mid"><div>' +
        esc(u.email) +
        '</div><div class="s">' +
        pSyncBadge() +
        '</div></span><button class="btn tonal" data-act="p-signout">Sign out</button></div>' +
        '<div class="setrow"><span class="mid"><div>Data from the old app</div><div class="s">Bring it back again (replaces what is here)</div></span><button class="btn tonal" data-act="p-reimport">Look</button></div>' +
        '<div class="setrow"><span class="mid"><div>Password</div></span><button class="btn tonal" data-act="p-newpass">Change</button></div></div>'
      : "";
  return h.slice(0, i) + mine + h.slice(i);
};

document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  switch (el.dataset.act) {
    case "p-auth-go":
      pAuthGo();
      break;
    case "p-auth-mode":
      P_AUTH.mode = el.dataset.v;
      P_AUTH.msg = "";
      P_AUTH.email = ($("#p-email") || {}).value || P_AUTH.email;
      render();
      break;
    case "p-signout":
      pSignOut();
      break;
    case "p-import-ok":
      pImportApply();
      break;
    case "p-reimport":
      snack("Looking…");
      pOldData().then(r => (r ? pImportSheet(r, true) : snack("No data from the old app in your account")));
      break;
    case "p-newpass":
      pNewPasswordSheet();
      break;
    case "p-pass-save":
      pPassSave();
      break;
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target && (e.target.id === "p-email" || e.target.id === "p-pass")) {
    e.preventDefault();
    pAuthGo();
  }
  if (e.key === "Enter" && e.target && e.target.id === "p-newpass") {
    e.preventDefault();
    pPassSave();
  }
});

/* start-up: before loadState (main.js), so the right person's notebook loads */
function pBootSession() {
  pUseNotebook();
}
/* after the first render: the email link, then the cloud; and keep in step while the app is open */
async function pStartCloud() {
  if (await pFromEmailLink()) render();
  if (pUser()) pFirstSync();
  addEventListener("online", () => (P_SYNC.dirty ? pPush() : pPull()));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pPull();
    else if (P_SYNC.dirty) pPush();
  });
  setInterval(() => (P_SYNC.dirty ? pPush() : pPull()), 60 * 1000);
}
