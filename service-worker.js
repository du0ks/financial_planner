const CACHE_NAME = 'finance-tracker-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './css/styles.css',
  './css/vendor/tailwind.min.css',
  './css/vendor/fontawesome/all.min.css',
  './css/vendor/webfonts/fa-solid-900.woff2',
  './css/vendor/webfonts/fa-regular-400.woff2',
  './js/app.js',
  './js/currency.js',
  './js/data.js',
  './js/export.js',
  './js/pwa.js',
  './js/storage.js',
  './js/ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

