// A stand-in for the Supabase endpoints the app uses (auth and two tables), kept in memory, for the cloud tests.
// It behaves like the real thing where it matters: unconfirmed emails can't sign in, tokens expire and refresh,
// each user sees only their own row, and a write with a stale revision changes nothing.
import http from "node:http";

export async function fakeSupabase({ tokenSeconds = 3600 } = {}) {
  const users = new Map(), // email → {id, email, password, confirmed}
    tokens = new Map(), // access token → {user, exp}
    refresh = new Map(), // refresh token → user
    appState = new Map(), // user id → {user_id, data, rev, updated_at}
    oldData = new Map(), // user id → extended_data (the old app's row)
    log = [];
  let n = 0,
    down = false;
  const issue = u => {
    const at = "at-" + u.id + "-" + ++n,
      rt = "rt-" + u.id + "-" + n;
    tokens.set(at, { user: u, exp: Date.now() + tokenSeconds * 1000 });
    refresh.set(rt, u);
    return { access_token: at, refresh_token: rt, expires_in: tokenSeconds, token_type: "bearer", user: { id: u.id, email: u.email } };
  };
  const who = req => {
    const t = (req.headers.authorization || "").replace("Bearer ", ""),
      s = tokens.get(t);
    return s && s.exp > Date.now() ? s.user : null;
  };
  const server = http.createServer(async (req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "apikey, authorization, content-type, prefer",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    };
    const send = (code, body) => {
      res.writeHead(code, Object.assign({ "Content-Type": "application/json" }, cors));
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return send(204);
    const url = new URL(req.url, "http://x"),
      p = url.pathname,
      q = url.searchParams;
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    if (!p.startsWith("/_test")) log.push(req.method + " " + p + url.search);
    if (down && !p.startsWith("/_test")) return req.socket.destroy(); // like no connection at all
    /* ---- test hooks ---- */
    if (p === "/_test/confirm") {
      users.get(q.get("email")).confirmed = true;
      return send(200, {});
    }
    if (p === "/_test/down") {
      down = q.get("on") === "1";
      return send(200, {});
    }
    if (p === "/_test/old") {
      oldData.set(users.get(body.email).id, body.ext);
      return send(200, {});
    }
    if (p === "/_test/row") return send(200, appState.get(users.get(q.get("email")).id) || null);
    if (p === "/_test/link") return send(200, issue(users.get(q.get("email"))));
    /* ---- auth ---- */
    if (p === "/auth/v1/signup") {
      if (users.has(body.email)) return send(200, { id: "obfuscated", email: body.email, identities: [] });
      const u = { id: "00000000-0000-4000-8000-" + String(users.size + 1).padStart(12, "0"), email: body.email, password: body.password, confirmed: false };
      users.set(body.email, u);
      return send(200, { id: u.id, email: u.email, identities: [{}] });
    }
    if (p === "/auth/v1/token" && q.get("grant_type") === "password") {
      const u = users.get(body.email);
      if (!u || u.password !== body.password) return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      if (!u.confirmed) return send(400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
      return send(200, issue(u));
    }
    if (p === "/auth/v1/token" && q.get("grant_type") === "refresh_token") {
      const u = refresh.get(body.refresh_token);
      if (!u) return send(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      refresh.delete(body.refresh_token);
      return send(200, issue(u));
    }
    if (p === "/auth/v1/user") {
      const u = who(req);
      if (!u) return send(401, { msg: "invalid JWT" });
      if (req.method === "PUT" && body.password) u.password = body.password;
      return send(200, { id: u.id, email: u.email });
    }
    if (p === "/auth/v1/logout") return send(204);
    if (p === "/auth/v1/recover") return send(200, {});
    /* ---- tables (row level security: only your own row) ---- */
    const u = who(req);
    if (p.startsWith("/rest/v1/") && !u) return send(401, { message: "JWT expired" });
    const own = q.get("user_id") === "eq." + (u && u.id);
    if (p === "/rest/v1/app_state") {
      if (req.method === "GET") {
        const row = own && appState.get(u.id);
        if (!row) return send(200, []);
        const cols = (q.get("select") || "*").split(",");
        return send(200, [cols[0] === "*" ? row : Object.fromEntries(cols.map(c => [c, row[c]]))]);
      }
      if (req.method === "POST") {
        if (body.user_id !== u.id) return send(403, { message: "new row violates row-level security policy" });
        if (appState.has(u.id)) return send(409, { code: "23505", message: "duplicate key value violates unique constraint" });
        const row = { user_id: u.id, data: body.data, rev: body.rev || 1, updated_at: new Date().toISOString() };
        appState.set(u.id, row);
        return send(201, [row]);
      }
      if (req.method === "PATCH") {
        const row = own && appState.get(u.id),
          rev = q.get("rev");
        if (!row || (rev && "eq." + row.rev !== rev)) return send(200, []);
        Object.assign(row, body);
        return send(200, [row]);
      }
    }
    if (p === "/rest/v1/user_data" && req.method === "GET") {
      const ext = own && oldData.get(u.id);
      return send(200, ext ? [{ extended_data: ext }] : []);
    }
    send(404, { message: "not found: " + p });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port;
  const hook = (path, body) => fetch(url + path, body ? { method: "POST", body: JSON.stringify(body) } : {}).then(r => r.json());
  return { url, server, log, hook, users, appState };
}
