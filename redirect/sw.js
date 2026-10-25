/* Replaces the app's worker at the old address: drops its caches and steps aside, so the moved notice loads. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", ev =>
  ev.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(cs => cs.forEach(c => c.navigate(c.url)))
  )
);
