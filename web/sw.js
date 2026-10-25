/*
 * sw.js — Works offline and opens fast: the app's own files come from the cache at once and are refreshed in the
 * background, so the next open has any update. Rates and other sites always go to the network (p-fx.js keeps its
 * own copy for offline use).
 */
"use strict";

const CACHE = "prosperity-app";

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "index.html"])).then(() => self.skipWaiting()));
});
/* taking over from the previous app's worker: its caches go, so its old pages never come back */
self.addEventListener("activate", ev =>
  ev.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", ev => {
  const req = ev.request,
    url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const key = req.mode === "navigate" ? new Request(new URL("./", self.registration.scope)) : req;
  ev.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(key, { ignoreSearch: true }).then(hit => {
        const fresh = fetch(req)
          .then(res => {
            if (res.ok) cache.put(key, res.clone());
            return res;
          })
          .catch(() => hit);
        if (hit) {
          ev.waitUntil(fresh);
          return hit;
        }
        return fresh;
      })
    )
  );
});
