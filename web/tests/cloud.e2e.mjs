// Your account and the cloud, end to end, in two real (headless) Firefox windows against a stand-in Supabase
// (fake-supabase.mjs): sign up, confirm, bring back the old app's data, save, two devices changing the same notebook,
// offline, signing out, a second person, email links, the sample. Run from the repository root:
//   node web/tests/cloud.e2e.mjs
import { createRequire } from "node:module";
import { launch, serveWeb } from "./driver.mjs";
import { fakeSupabase } from "./fake-supabase.mjs";

const { oldDoc } = createRequire(import.meta.url)("./fixtures.cjs");
/* tokens that last 30 s: the app refreshes them before every call, so refreshing is tested all along */
const api = await fakeSupabase({ tokenSeconds: 30 });
const web = await serveWeb({ api: api.url });
const APP = web.url + "index.html";
let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : ""));
};
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    fails++;
    console.log("FAIL", name, e.message);
  }
};
const until = async (b, expr, ms = 6000) => {
  for (let t = 0; t < ms; t += 200) {
    if (await b.js(expr)) return true;
    await b.wait(200);
  }
  return false;
};
const type = (b, sel, v) => b.js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input", {bubbles: true})); return true; })()`);
const text = (b, sel) => b.js(`(document.querySelector(${JSON.stringify(sel)}) || {innerText: ""}).innerText`);
const row = email => api.hook("/_test/row?email=" + encodeURIComponent(email));
const signIn = async (b, email, pass) => {
  await type(b, "#p-email", email);
  await type(b, "#p-pass", pass);
  await b.click('[data-act="p-auth-go"]');
};
const spend = async (b, cat, account, amount, note) => {
  await b.click('[data-act="add-out"]');
  await b.click('#sheet [data-act="f-cat"][data-v="' + cat + '"]');
  await b.click('#sheet [data-act="f-acc"][data-v="' + account + '"]');
  await type(b, "#f-amt", String(amount));
  if (note) await type(b, "#f-note", note);
  await b.click('#sheet [data-act="tx-save"]');
};

const ME = "onat@example.com",
  PW = "correct horse battery",
  A = await launch(),
  B = await launch();

await step("signed out", async () => {
  await A.go(APP);
  await A.wait(700);
  ok("the sign-in page, no tabs", (await text(A, "#app")).includes("Welcome back") && !(await A.js("document.body.classList.contains('hasnav')")));
});
await step("create an account", async () => {
  await A.click('[data-act="p-auth-mode"][data-v="up"]');
  await signIn(A, ME, "short");
  ok("a short password is refused", (await text(A, "#app")).includes("at least 8 characters"));
  await signIn(A, ME, PW);
  ok("asked to confirm the email", await until(A, "document.querySelector('#app').innerText.includes('Almost there')"));
  await signIn(A, ME, PW);
  ok("can't sign in before confirming", await until(A, "document.querySelector('#app').innerText.includes('Confirm your email first')"));
  await signIn(A, ME, "wrong password!!");
  ok("a wrong password says so", await until(A, "document.querySelector('#app').innerText.includes('Wrong email or password')"));
});
await step("first sign-in brings back the old app's data", async () => {
  await api.hook("/_test/confirm?email=" + encodeURIComponent(ME));
  await api.hook("/_test/old", { email: ME, ext: { version: 5, doc: oldDoc() } });
  await signIn(A, ME, PW);
  ok("offers the old data", await until(A, "document.querySelector('#sheet').innerText.includes('Your data from the old app')"));
  const sheet = await text(A, "#sheet");
  ok("lists the accounts and what is left out", sheet.includes("Wise CZK") && sheet.includes("planned purchase") && sheet.includes("Gökhan Bey"));
  await A.click('#sheet [data-act="p-import-ok"]');
  ok("brought back and saved to the cloud", await until(A, "!P_SYNC.dirty && P_SYNC.state === 'saved'"));
  const r = await row(ME);
  ok("the cloud row has it", r && r.rev >= 1 && r.data.accounts.length === 4 && r.data.txns.length > 5, r && "rev " + r.rev);
  const bal = await A.js("JSON.stringify(balances())");
  ok("balances as in the old app", JSON.parse(bal)["acct-wise"] === 7100 && JSON.parse(bal)["acct-card"] === -3990, bal);
  ok("categories named as before, unused ones hidden", await A.js("cat('housing').name === 'Dorm' && cat('cat-canteen').name === 'Canteen' && S.cats.find(c => c.id === 'fun').hidden"));
  ok("everyday currency CZK, budgets back", await A.js("S.settings.cur === 'CZK' && S.budgets['cat-canteen'].amount === 1625"));
});
await step("every change goes to the cloud", async () => {
  const rev0 = (await row(ME)).rev;
  await spend(A, "cat-canteen", "acct-wise", 95, "Canteen A1");
  ok("saved", await until(A, "!P_SYNC.dirty && P_SYNC.state === 'saved'"));
  const r = await row(ME);
  ok("the cloud has the new entry", r.rev === rev0 + 1 && r.data.txns.some(t => t.note === "Canteen A1"), "rev " + rev0 + " → " + r.rev);
});
await step("a second device", async () => {
  await B.go(APP);
  await B.wait(700);
  await signIn(B, ME, PW);
  ok("signs in to the same notebook, no import asked", await until(B, "S.txns.some(t => t.note === 'Canteen A1')") && !(await B.js("!!document.querySelector('#sheet').innerHTML")));
});
await step("both devices change it at once", async () => {
  /* B adds; A, which hasn't seen that yet, deletes an old entry and adds its own */
  await spend(B, "food", "acct-wise", 40, "Coffee B");
  ok("B saved", await until(B, "!P_SYNC.dirty && P_SYNC.state === 'saved'"));
  await A.js("withUndo('x', () => { S.txns = S.txns.filter(t => t.note !== 'Lunch'); }); true");
  await spend(A, "cat-canteen", "acct-wise", 50, "Canteen A2");
  ok("A saved after merging", await until(A, "!P_SYNC.dirty && P_SYNC.state === 'saved'"));
  const r = await row(ME),
    notes = r.data.txns.map(t => t.note);
  ok("the cloud has both devices' entries and not the deleted one", notes.includes("Coffee B") && notes.includes("Canteen A2") && notes.includes("Canteen A1") && !notes.includes("Lunch"));
  ok("A shows B's entry", await A.js("S.txns.some(t => t.note === 'Coffee B')"));
  await B.js("document.dispatchEvent(new Event('visibilitychange')); pPull(); true");
  ok("B takes in A's changes", await until(B, "S.txns.some(t => t.note === 'Canteen A2') && !S.txns.some(t => t.note === 'Lunch')"));
  ok("both devices hold the same notebook", (await A.js("JSON.stringify(balances())")) === (await B.js("JSON.stringify(balances())")));
});
await step("offline", async () => {
  await api.hook("/_test/down?on=1");
  await spend(A, "cat-canteen", "acct-wise", 30, "Offline A3");
  ok("kept on the device and says offline", await until(A, "P_SYNC.dirty && P_SYNC.state === 'offline'"));
  ok("the entry is on screen anyway", await A.js("S.txns.some(t => t.note === 'Offline A3')"));
  await api.hook("/_test/down?on=0");
  await A.js("dispatchEvent(new Event('online')); true");
  ok("saved once back online", await until(A, "!P_SYNC.dirty && P_SYNC.state === 'saved'"));
  ok("the cloud has it", (await row(ME)).data.txns.some(t => t.note === "Offline A3"));
});
await step("two windows of the app on one device", async () => {
  /* a second tab in the same browser, as when the app is open in a tab and in its installed window */
  const A2 = await A.tab();
  await A2.go(APP);
  ok("the second window loads the notebook", await until(A2, "P_SYNC.state === 'saved' && S.txns.some(t => t.note === 'Offline A3')"));
  await A.js("acc('acct-card').c = '#123456'; commit(); true");
  ok("first window saved", await until(A, "!P_SYNC.dirty && P_SYNC.state === 'saved'") && (await row(ME)).data.accounts.find(a => a.id === "acct-card").c === "#123456");
  ok("the other window shows it at once", await until(A2, "acc('acct-card').c === '#123456'"));
  /* the left-open window saves something of its own (as fetching a past day's rates does) */
  await A2.js("S.fxDays['2026-01-02'] = {USD: 1}; save(); true");
  ok("its save keeps the first window's change", await until(A2, "!P_SYNC.dirty && P_SYNC.state === 'saved'") && (await row(ME)).data.accounts.find(a => a.id === "acct-card").c === "#123456");
  /* a window that missed the news (asleep): its old copy must not overwrite newer changes */
  await A2.js("window.__stale = {s: JSON.stringify(S), b: JSON.stringify(P_BASE)}; true");
  await A.js("acc('acct-card').c = '#654321'; commit(); true");
  await until(A, "!P_SYNC.dirty && P_SYNC.state === 'saved'");
  await A2.js("S = migrate(JSON.parse(__stale.s)); P_BASE = JSON.parse(__stale.b); S.fxDays['2026-01-03'] = {USD: 1}; save(); true");
  ok("a window with an old copy merges instead of overwriting", await until(A2, "!P_SYNC.dirty && P_SYNC.state === 'saved'"));
  const r = await row(ME);
  ok("the cloud keeps the newer change and the old window's own", r.data.accounts.find(a => a.id === "acct-card").c === "#654321" && r.data.fxDays["2026-01-03"], r.data.accounts.find(a => a.id === "acct-card").c);
  ok("and the old window catches up", await until(A2, "acc('acct-card').c === '#654321'"));
  await A2.js("close(); true").catch(() => {});
});
await step("sign out", async () => {
  await A.click('#nav [data-v="home"]');
  await A.click('[data-act="go"][data-v="settings"]');
  ok("Settings shows the account and that it's saved", (await text(A, "#app")).includes(ME) && (await text(A, "#app")).includes("Saved"));
  await A.click('[data-act="p-signout"]');
  ok("back to the sign-in page", await until(A, "document.querySelector('#app').innerText.includes('Welcome back')"));
  ok("this device forgot the notebook", await A.js("!Object.keys(localStorage).some(k => k.startsWith('prosperity:v1:0')) && !localStorage.getItem('prosperity:session')"));
});
await step("someone else on the same device", async () => {
  const HER = "her@example.com";
  await A.click('[data-act="p-auth-mode"][data-v="up"]');
  await signIn(A, HER, PW);
  await until(A, "document.querySelector('#app').innerText.includes('Almost there')");
  await api.hook("/_test/confirm?email=" + encodeURIComponent(HER));
  await signIn(A, HER, PW);
  ok("a fresh notebook: none of the first person's data", await until(A, "pUser() && pUser().email === 'her@example.com'") && (await A.js("S.accounts.length === 0 && S.txns.length === 0")));
  ok("starts with choosing an everyday currency", (await text(A, "#app")).includes("everyday currency"));
  const his = await row(ME);
  await A.js("S.settings.cur = 'UAH'; commit(); true");
  await until(A, "!P_SYNC.dirty");
  const hers = await row(HER);
  ok("her notebook is saved apart, and his is untouched", hers && hers.data.settings.cur === "UAH" && hers.user_id !== his.user_id && JSON.stringify(await row(ME)) === JSON.stringify(his));
  await A.js("pSignOut(); true");
  await until(A, "!pUser()");
});
await step("email links", async () => {
  const link = await api.hook("/_test/link?email=" + encodeURIComponent(ME));
  await A.go(APP + "?from=email#access_token=" + link.access_token + "&refresh_token=" + link.refresh_token + "&expires_in=30&type=signup");
  ok("the confirmation link signs you in", await until(A, "pUser() && pUser().email === 'onat@example.com'"));
  ok("…and cleans the address", await A.js("location.hash === ''"));
  ok("…and loads the notebook from the cloud", await until(A, "S.txns.some(t => t.note === 'Offline A3')"));
  const rec = await api.hook("/_test/link?email=" + encodeURIComponent(ME));
  await A.go(APP + "?from=reset#access_token=" + rec.access_token + "&refresh_token=" + rec.refresh_token + "&expires_in=30&type=recovery");
  ok("a password reset link asks for a new password", await until(A, "document.querySelector('#sheet').innerText.includes('Set a new password')"));
  await type(A, "#p-newpass", "a brand new password");
  await A.click('#sheet [data-act="p-pass-save"]');
  ok("the new password is saved", await until(A, "!document.querySelector('#sheet').innerHTML") && api.users.get(ME).password === "a brand new password");
});
await step("the sample never reaches an account", async () => {
  await B.js("pSignOut(); true");
  await until(B, "!pUser()");
  const writes = api.log.filter(l => /^(POST|PATCH) \/rest/.test(l)).length;
  await B.click('[data-act="p-demo"]');
  await B.wait(1500);
  ok("sample loaded", await B.js("pIsDemo() && S.accounts.length > 3"));
  await spend(B, "groceries", "wisecz", 10, "Sample spend");
  await B.wait(2000);
  ok("nothing written to the cloud", api.log.filter(l => /^(POST|PATCH) \/rest/.test(l)).length === writes);
});
for (const [name, b] of [["A", A], ["B", B]]) {
  const errs = b.logs.filter(l => /error/i.test(l) && !/NetworkError|ERR_CONNECTION|connection was reset|CORS request did not succeed/i.test(l));
  ok("no errors in the console (" + name + ")", errs.length === 0, errs.join(" ; "));
}
console.log(fails ? fails + " FAILED" : "ALL PASSED");
await A.close();
await B.close();
api.server.close();
web.server.close();
process.exit(fails ? 1 : 0);
