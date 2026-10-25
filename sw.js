// Service worker: caches the app shell so the app installs and opens fast.
// Data always comes live from Supabase (never cached here).
// Bump CACHE when you change any file below so phones pick up the update.
const CACHE = 'finance-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/css/volt.min.css',
  '/assets/css/app.css',
  '/assets/js/config.js',
  '/assets/js/app.js',
  '/assets/vendor/bootstrap.bundle.min.js',
  '/assets/vendor/chart.umd.min.js',
  '/assets/icons/logo.svg',
  '/assets/icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GETs: network first, fall back to cache when offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
