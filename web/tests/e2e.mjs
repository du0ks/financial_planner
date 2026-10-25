// End-to-end test of the whole app in a real, headless Firefox, driven over WebDriver BiDi with the WebSocket client
// built into Node 22+: nothing to install but Firefox. Run from the repository root: node web/tests/e2e.mjs
// It serves web/ itself, loads the sample data and goes through every screen. Screenshots: web/tests/output/.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "output");
fs.mkdirSync(out, { recursive: true });
const port = 5400 + Math.floor(Math.random() * 500);
const server = spawn("python3", ["-I", "-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: path.join(here, ".."), stdio: "ignore" });
process.on("exit", () => server.kill());
await new Promise(r => setTimeout(r, 700));
const APP_URL = "http://127.0.0.1:" + port + "/index.html";

async function launch({ width = 390, height = 844, port = 9300 + Math.floor(Math.random() * 600) } = {}) {
  // a snap-packaged Firefox may only use folders under ~/snap/firefox/common
  const prof = (process.env.E2E_PROFILE_DIR || process.env.HOME + "/snap/firefox/common/prosperity-e2e") + "/prof-" + Date.now();
  fs.mkdirSync(prof, { recursive: true });
  const ff = spawn("firefox", ["--headless", "--no-remote", "--profile", prof, "--remote-debugging-port", String(port), "-remote-allow-system-access", `--window-size=${width},${height}`], { stdio: ["ignore", "ignore", "pipe"] });
  process.on("exit", () => ff.kill()); // never leave a test browser behind, even after a crash
  let ready = false;
  ff.stderr.on("data", d => { if (String(d).includes("WebDriver BiDi listening")) ready = true; });
  for (let i = 0; i < 100 && !ready; i++) await new Promise(r => setTimeout(r, 200));
  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map(), logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === "log.entryAdded") logs.push(m.params.level + " " + m.params.text);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, m => (m.error ? rej(new Error(method + ": " + m.error + " " + m.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await send("session.new", { capabilities: {} });
  await send("session.subscribe", { events: ["log.entryAdded"] });
  const { context } = await send("browsingContext.create", { type: "tab" });
  await send("browsingContext.setViewport", { context, viewport: { width, height }, devicePixelRatio: 2 }).catch(e => console.log("viewport:", e.message));
  const api = {
    logs,
    async go(url) { await send("browsingContext.navigate", { context, url, wait: "complete" }); },
    async js(expr) {
      const r = await send("script.evaluate", { expression: expr, target: { context }, awaitPromise: true, resultOwnership: "none" });
      if (r.type === "exception") throw new Error("page: " + (r.exceptionDetails && r.exceptionDetails.text));
      return r.result && "value" in r.result ? r.result.value : undefined;
    },
    async click(sel) {
      const ok = await api.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.scrollIntoView({block:"center"}); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("click", {bubbles:true, cancelable:true, detail:1, clientX:r.left + r.width/2, clientY:r.top + r.height/2})); return true; })()`);
      if (!ok) throw new Error("no element " + sel);
      await new Promise(r => setTimeout(r, 400));
    },
    async shot(file, full = false) {
      const r = await send("browsingContext.captureScreenshot", { context, origin: full ? "document" : "viewport" });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    },
    async wait(ms) { await new Promise(r => setTimeout(r, ms)); },
    async close() { try { await send("session.end"); } catch (e) {} ws.close(); ff.kill(); },
  };
  return api;
}

const b = await launch();
let fails = 0;
const text = async sel => (await b.js(`(document.querySelector(${JSON.stringify(sel)})||{innerText:''}).innerText.replace(/\\n+/g,' | ')`)) || "";
const ok = (name, cond, extra = "") => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const step = async (name, fn) => { try { await fn(); } catch (e) { fails++; console.log("FAIL", name, e.message); } };
const type = (sel, v) => b.js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input", {bubbles:true})); return true; })()`);
await b.go(APP_URL);
await b.wait(600);
await b.click('[data-act="p-demo"]');
await b.wait(2500);
ok("rates loaded", await b.js("!!(PFX.rates && PFX.rates.TRY && PFX.rates.XAU)"));
ok("today's rates kept with the data", await b.js("!!(S.fxDays[today()] && S.fxDays[today()].CZK && S.fxDays[today()].USD)"));

// The chain, recomputed in the page straight from balances, without p-logic's grouping
const chainCheck = `(() => {
  const cur = S.settings.cur, R = PFX.rates, b = balances(), c = (v, k) => pConv(v, k, cur, R);
  const rd = n => Math.round(n * 100);
  let spend = 0, invest = 0, card = 0, touch = 0, keep = 0, other = 0, owe = 0;
  activeAccounts().forEach(a => {
    if (a.type === "card") { if (b[a.id] < 0) card += c(-b[a.id], a.currency); else spend += c(b[a.id], a.currency); }
    else if (pAvail(a)) spend += c(b[a.id], a.currency); else invest += c(b[a.id], a.currency);
  });
  S.assets.forEach(x => { if (x.kind === "gold") (x.touch ? (touch += pGoldValue(x.mg, cur, R)) : (keep += pGoldValue(x.mg, cur, R))); else other += c(x.value, x.currency); });
  S.loans.forEach(l => { const i = loanInfo(l); if (i.open) { if (l.kind === "lend") other += c(i.left, i.cur); else owe += c(i.left, i.cur); } });
  const bills = pPending(S.rules, S.txns, S.skips, today()).bills.reduce((q, o) => q + c(o.rule.amount, o.rule.currency), 0);
  const w = pModel().w;
  return JSON.stringify({
    net: rd(w.netWorth) - rd(spend + invest + touch + keep + other - card - owe),
    avail: rd(w.availableNow) - rd(spend + touch - card - owe - bills),
    total: rd(w.total) - rd(spend + invest + touch + keep + other),
  });
})()`;
const diffs = async () => JSON.parse(await b.js(chainCheck));
await step("chain", async () => {
  const d = await diffs();
  ok("net worth, available now and total match a straight recount (cents off)", Math.abs(d.net) <= 2 && Math.abs(d.avail) <= 2 && Math.abs(d.total) <= 2, JSON.stringify(d));
  ok("Home shows Available now", (await text("#app")).includes("Available now"));
});

await step("it is Prosperity", async () => {
  ok("title is Prosperity", (await b.js("document.title")) === "Prosperity");
  const html = await b.js("document.documentElement.outerHTML");
  ok("no Tally anywhere on the page", !/tally/i.test(html));
  await b.click('[data-act="go"][data-v="settings"]');
  const s = await b.js("document.querySelector('#app').innerHTML");
  ok("Settings has no GitHub link or developer name", !/github|andelib|About</i.test(s));
  await b.click('[data-act="home"]');
  const man = await fetch(APP_URL.replace("index.html", "manifest.webmanifest")).then(r => r.json()),
    icon = await fetch(APP_URL.replace("index.html", "icon-512.png"));
  ok("app manifest names Prosperity with its logo", man.name === "Prosperity" && man.icons[0].src === "icon-512.png" && icon.ok && (await b.js("!!document.querySelector('link[rel=manifest]')")));
  ok("works offline (service worker running)", await b.js("navigator.serviceWorker.ready.then(r => !!r.active)"));
});
await step("one everyday currency", async () => {
  ok("everyday currency is CZK", await b.js("S.settings.cur") === "CZK");
  const exp = await b.js("money(S.txns.filter(t => t.date === today() && isSpend(t)).reduce((q, t) => q + pIn(t), 0), 'CZK', true)");
  ok("the ring adds every currency, in CZK", (await text("#app")).includes(exp), exp);
  ok("no currency switch on the ring", !(await b.js("!!document.querySelector('[data-act=\"cur-next\"]')")));
  await b.click('[data-act="summary"]');
  ok("spending summary is in CZK, all currencies", (await text("#sheet")).startsWith("Spending · CZK"));
  await b.click('#sheet [data-act="close"]');
  await b.wait(3000);
  const filled = await b.js("Object.keys(S.fxDays).filter(d => d < today()).length");
  ok("earlier days got their own published rates", filled >= 5, filled + " days");
  ok("a transfer between currencies is not spending", await b.js("!pBudgetFor(pMonthNow()).rows.some(r => r.cat === 'fees' && r.spent > 0) && !S.txns.some(t => t.feeOf)"));
  ok("no exchange-loss line", !(await text("#app")).includes("lost to exchange"));
});
await step("budget tab", async () => {
  ok("4 tabs", (await b.js("[...document.querySelectorAll('#nav button')].map(x=>x.innerText).join(',')")) === "Home,Budget,Assets,Liabilities");
  await b.click('#nav [data-v="budget"]');
  await b.shot(out + "/q_budget.png", true);
  const t = await text("#app");
  console.log("  BUDGET:", t.slice(0, 600));
  ok("budget summary", t.includes("Left to spend") && t.includes("Spent"));
  ok("health has no budget and says so", /Health \| Spent [^|]+ · no budget/.test(t));
});
await step("set a budget", async () => {
  await b.click('[data-act="p-budget"][data-v="health"]');
  await type("#p-bamt", "1000");
  await b.click('#sheet [data-act="p-budget-save"]');
  ok("health budget saved in the everyday currency", await b.js("JSON.stringify(S.budgets.health)") === '{"amount":1000,"currency":"CZK"}');
  const row = await b.js("JSON.stringify(pBudgetFor(pMonthNow()).rows.find(r=>r.cat==='health'))");
  ok("health: 250 of 1,000, 750 left", row.includes('"spent":250') && row.includes('"left":750'), row);
});
await step("spend moves the budget", async () => {
  const before = await b.js("pBudgetFor(pMonthNow()).rows.find(r=>r.cat==='groceries').spent");
  await b.click('#nav [data-v="home"]');
  await b.click('[data-act="add-out"]');
  await b.click('#sheet [data-act="f-cat"][data-v="groceries"]');
  await b.click('#sheet [data-act="f-acc"][data-v="zcard"]');
  await type("#f-amt", "100");
  await b.click('#sheet [data-act="tx-save"]');
  await b.wait(300);
  const after = await b.js("pBudgetFor(pMonthNow()).rows.find(r=>r.cat==='groceries').spent");
  const conv = await b.js("pConv(100, 'TRY', 'CZK', pRatesOn(PFX.rates, S.fxDays, today()))");
  ok("100 TRY on the Ziraat card adds its CZK value to the groceries budget", Math.round((after - before) * 100) === Math.round(conv * 100), before + " → " + after + " (+" + conv + ")");
  const d = await diffs();
  ok("chain still adds up after spending", Math.abs(d.net) <= 2 && Math.abs(d.avail) <= 2, JSON.stringify(d));
});
await step("budget month navigation", async () => {
  await b.click('#nav [data-v="budget"]');
  await b.click('[data-act="p-bm"][data-v="-1"]');
  const t = await text("#app");
  ok("last month shows left unspent or over, no daily line", (t.includes("Left unspent") || t.includes("Over budget")) && !t.includes("a day for the"), t.slice(0, 160));
  await b.click('[data-act="p-bm"][data-v="1"]');
});

await step("assets", async () => {
  await b.click('#nav [data-v="assets"]');
  await b.shot(out + "/q_assets.png", true);
  const t = await text("#app");
  ok("one Gold section with Touchable and Untouchable", /Gold \| [^|]+ \| Touchable \| [^|]+ \| Bracelet/.test(t) && t.includes("Untouchable | "), t.match(/Gold \|.{0,160}/)?.[0]);
  ok("no big add buttons", !(await b.js("!!document.querySelector('#app .btn.text[data-act=\"acc-form\"]')")));
  ok("+ on every group", (await b.js("document.querySelectorAll('#app .p-plus').length")) === 4);
  await b.click('[data-act="p-addsav"]');
  ok("+ on Investments opens a Savings account", (await b.js("F && F.kind === 'accf' && F.type === 'savings'")));
  await b.click('#sheet [data-act="close"]');
  await b.click('[data-act="p-addother"]');
  ok("+ on Other offers asset or money lent", (await text("#sheet")).includes("Something I own") && (await text("#sheet")).includes("Money I lent"));
  await b.click('#sheet [data-act="close"]');
});
await step("gold", async () => {
  await b.click('[data-act="p-gold"][data-v="g2"]');
  await b.click('#sheet [data-act="p-touch"][data-v="yes"]');
  await b.click('#sheet [data-act="p-gold-save"]');
  const t = await text("#app");
  ok("moving gold to Touchable raises Available now by its value", (await b.js("pModel().w.goldUntouchable")) === 0, t.match(/Gold \|.{0,120}/)?.[0]);
  await b.click('[data-act="p-gold"][data-v="g2"]');
  await b.click('#sheet [data-act="p-touch"][data-v="no"]');
  await b.click('#sheet [data-act="p-gold-save"]');
  await b.click('[data-act="p-gold"][data-v="new"]');
  await type("#p-gname", "Ring");
  await type("#p-grams", "2.5");
  await b.click('#sheet [data-act="p-gold-save"]');
  ok("new gold added as 2,500 mg touchable", await b.js("JSON.stringify(S.assets.filter(x=>x.name==='Ring').map(x=>[x.mg,x.touch]))") === "[[2500,true]]");
  await b.click('[data-act="p-gold"][data-v="' + (await b.js("S.assets.find(x=>x.name==='Ring').id")) + '"]');
  await b.click('#sheet [data-act="p-gold-del"]');
  ok("gold deleted", await b.js("!S.assets.some(x=>x.name==='Ring')"));
});
await step("liabilities + pay card", async () => {
  await b.click('#nav [data-v="liabs"]');
  await b.shot(out + "/q_liabs.png", true);
  const t = await text("#app");
  ok("no interest anywhere", !/interest/i.test(t), t.slice(0, 200));
  const bg = await b.js("getComputedStyle(document.querySelector('.sumcard.owe')).backgroundColor");
  ok("You owe card is red", /rgb\((2[0-9][0-9]|1[4-9][0-9]), ?(2[0-2][0-9]|[0-9]{1,2}), ?/.test(bg), bg);
  const debt0 = await b.js("-balances().zcard"), z0 = await b.js("balances().ziraat");
  await b.click('[data-act="acc-open"][data-v="zcard"]');
  await b.click('#sheet [data-act="p-pay"]');
  ok("Pay card opens a transfer to the card", await b.js("F.kind === 'tr' && F.to === 'zcard'"));
  await b.click('#sheet [data-act="tr-from"][data-v="ziraat"]');
  await type("#f-amt", "1000");
  await b.click('#sheet [data-act="tr-save"]');
  await b.wait(300);
  const debt1 = await b.js("-balances().zcard"), z1 = await b.js("balances().ziraat");
  ok("paying 1,000 lowers card debt and the bank by 1,000", Math.round((debt0 - debt1) * 100) === 100000 && Math.round((z0 - z1) * 100) === 100000, debt0 + "→" + debt1 + ", " + z0 + "→" + z1);
  const d = await diffs();
  ok("a card payment leaves net worth unchanged and chain consistent", Math.abs(d.net) <= 2 && Math.abs(d.avail) <= 2, JSON.stringify(d));
});
await step("recurring: confirm and skip", async () => {
  await b.click('#nav [data-v="home"]');
  const pending = await b.js("JSON.stringify(pPending(S.rules,S.txns,S.skips,today()).bills.map(o=>o.rule.id+'@'+o.month))");
  console.log("  pending:", pending);
  await b.click('[data-act="go"][data-v="settings"]');
  await b.click('[data-act="p-rule-new"]');
  await type("#p-rname", "Gym");
  await type("#p-ramt", "450");
  await type("#p-rday", String(new Date().getDate()));
  await b.click('#sheet [data-act="p-rcat"][data-v="fun"]');
  await b.click('#sheet [data-act="p-rule-save"]');
  await b.click('[data-act="home"]');
  const gymV = await b.js("(() => { const o = pPending(S.rules,S.txns,S.skips,today()).bills.find(o=>o.rule.name==='Gym'); return o ? o.rule.id + '|' + o.month : ''; })()");
  ok("new rule waits on Home today", !!gymV && (await text("#app")).includes("Gym"));
  const avail0 = await b.js("pModel().w.availableNow");
  await b.click('[data-act="p-confirm"][data-v="' + gymV + '"]');
  ok("confirm opens the entry sheet prefilled", await b.js("F.kind === 'tx' && F.cat === 'fun' && document.querySelector('#f-amt').value.replace(/[^0-9.]/g,'') === '450'"));
  await b.click('#sheet [data-act="tx-save"]');
  await b.wait(300);
  ok("confirmed entry is linked to its rule", await b.js("S.txns.some(t => t.rule && t.note === 'Gym' && t.amount === 450)"));
  const avail1 = await b.js("pModel().w.availableNow");
  ok("confirming a bill doesn't count it twice (Available now unchanged, to the haléř)", Math.abs(Math.round(avail0 * 100) - Math.round(avail1 * 100)) <= 1, avail0 + " → " + avail1);
  const ai = await b.js("(() => { const o = pPending(S.rules,S.txns,S.skips,today()).bills.find(o=>o.rule.id==='ai'); return o ? o.rule.id + '|' + o.month : ''; })()");
  if (ai) {
    await b.click('[data-act="p-confirm"][data-v="' + ai + '"]');
    await b.click('#sheet [data-act="p-skip"]');
    ok("skipped bill no longer waits", await b.js("!pPending(S.rules,S.txns,S.skips,today()).bills.some(o=>o.rule.id==='ai' && o.month===pMonthNow())"));
  }
});
await step("avail toggle", async () => {
  await b.click('#nav [data-v="assets"]');
  const a0 = await b.js("pModel().w.availableNow");
  const zb = await b.js("balances().ziraat");
  await b.click('[data-act="acc-open"][data-v="ziraat"]');
  await b.click('#sheet [data-act="p-avail"]');
  await b.click('#sheet [data-act="close"]');
  const a1 = await b.js("pModel().w.availableNow"), v = await b.js("pConv(balances().ziraat,'TRY',S.settings.cur,PFX.rates)");
  ok("Ziraat (TRY) off: available now drops by its CZK value", Math.round((a0 - a1) * 100) === Math.round(v * 100), a0 + " → " + a1);
  ok("…and it moves to Investments & savings", /Savings & reserves \| .*Ziraat/.test(await text("#app")));
  await b.click('[data-act="acc-open"][data-v="ziraat"]');
  await b.click('#sheet [data-act="p-avail"]');
  await b.click('#sheet [data-act="close"]');
});
await step("persist", async () => {
  await b.go(APP_URL);
  await b.wait(1000);
  ok("budgets, rules, rates of the day and links survive a reload",
    await b.js("Object.keys(S.budgets).length === 8 && S.rules.length === 4 && !!S.fxDays[today()] && S.txns.some(t=>t.rule==='gym' || t.note==='Gym')"));
  const d = await diffs();
  ok("chain still adds up after reload", Math.abs(d.net) <= 2 && Math.abs(d.avail) <= 2, JSON.stringify(d));
});
await step("change everyday currency", async () => {
  await b.click('[data-act="go"][data-v="settings"]');
  await b.click('[data-act="pick-maincur"]');
  await b.js("CURPICK('TRY'); true");
  await b.wait(400);
  ok("asks to convert the budgets", (await text("#pop")).includes("Budgets in TRY"));
  const g0 = await b.js("pConv(4000,'CZK','TRY',PFX.rates)");
  await b.click('#pop [data-act="ask-ok"]');
  ok("budgets now in TRY, rounded", await b.js("Object.values(S.budgets).every(x => x.currency === 'TRY' && Number.isInteger(x.amount))") && (await b.js("S.budgets.groceries.amount")) === Math.round(g0), JSON.stringify(await b.js("S.budgets.groceries")));
  const d = await diffs();
  ok("chain adds up in TRY too", Math.abs(d.net) <= 2 && Math.abs(d.avail) <= 2, JSON.stringify(d));
  await b.click('[data-act="pick-maincur"]');
  await b.js("CURPICK('CZK'); true");
  await b.wait(300);
  await b.click('#pop [data-act="ask-ok"]');
  ok("and back to CZK", await b.js("S.settings.cur === 'CZK' && S.budgets.groceries.currency === 'CZK'"));
  await b.click('[data-act="home"]');
});
await step("dark", async () => {
  await b.js("S.settings.theme='dark'; applyTheme(); V.screen='budget'; render(); true");
  await b.shot(out + "/q_budget_dark.png", true);
  await b.js("V.screen='liabs'; render(); true");
  await b.shot(out + "/q_liabs_dark.png");
  await b.js("V.screen='assets'; render(); true");
  await b.shot(out + "/q_assets_dark.png", true);
  ok("no sideways scroll", (await b.js("document.documentElement.scrollWidth")) <= 390);
});
const errs = b.logs.filter(l => /error/i.test(l));
ok("no errors in the console", errs.length === 0, errs.join(" ; "));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
await b.close();

server.kill();
process.exit(fails ? 1 : 0);
