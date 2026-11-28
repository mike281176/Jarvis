// J.A.R.V.I.S. · Service Worker
// Zweck: alte Caches der früheren App-Version entfernen und immer die aktuelle Seite laden.
const CACHE_PREFIX = 'jarvis-';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Netzwerk zuerst: die App ist eine Live-Anzeige, veraltete Kopien wären schlimmer als ein Fehler.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
