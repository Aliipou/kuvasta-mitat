/**
 * sw.js — Service Worker for Kuvasta Mitat.
 *
 * Strategy: Cache-first for static assets, network-only for CDN scripts.
 * Enables offline use after first visit.
 */

const CACHE_NAME  = 'kuvasta-mitat-v1';
const STATIC_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/src/app.js',
  '/src/upload.js',
  '/src/canvas-ruler.js',
  '/src/measurer.js',
  '/src/detector.js',
  '/src/results.js',
];

// ── Install: pre-cache static shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for own assets, pass-through for CDN ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // CDN resources — always network (models, charting libs)
  if (url.hostname !== location.hostname) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
