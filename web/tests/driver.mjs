// Driving a real, headless Firefox over WebDriver BiDi with the WebSocket client built into Node 22+, and serving
// web/ for it: nothing to install but Firefox (a snap Firefox may only use folders under ~/snap/firefox/common).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function launch({ width = 390, height = 844, port = 9300 + Math.floor(Math.random() * 600) } = {}) {
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

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };
/* web/ over http; `api` (an origin) replaces the cloud in config.js and is allowed by the page's security policy */
export function serveWeb({ api } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let file = path.join(WEB, decodeURIComponent(url.pathname));
    if (!file.startsWith(WEB)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    let body = fs.readFileSync(file);
    if (api && file.endsWith("index.html")) body = String(body).replace("connect-src ", "connect-src " + api + " ");
    if (api && file.endsWith(path.join("js", "config.js"))) body = 'window.PROSPERITY_API = { url: "' + api + '", key: "test-anon-key" };';
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r({ server, url: "http://127.0.0.1:" + server.address().port + "/" })));
}
