/**
 * J.A.R.V.I.S. Service Worker
 * Für Offline-Fähigkeit und schnelles Laden
 */

const CACHE_NAME = 'jarvis-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/sw.js',
    '/manifest.json'
];

// Install Event
self.addEventListener('install', event => {
    console.log('[J.A.R.V.I.S.] Service Worker v3 installiert');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            // Alle alten Jarvis-Caches löschen
            return Promise.all(
                cacheNames
                    .filter(name => name.startsWith('jarvis-'))
                    .map(name => caches.delete(name))
            );
        }).then(() => caches.open(CACHE_NAME))
          .then(cache => cache.addAll(urlsToCache))
    );
    
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
    console.log('[J.A.R.V.I.S.] Service Worker v3 aktiviert');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event
self.addEventListener('fetch', event => {
    // Externe Anfragen niemals abfangen
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        fetch(event.request, { cache: 'no-store' })
            .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : undefined)))
    );
});

// Sofort auf Updates reagieren und Clients übernehmen
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
