/**
 * J.A.R.V.I.S. Service Worker
 * Network-first für statische Assets, damit Updates sofort sichtbar sind.
 */

const CACHE_NAME = 'jarvis-v29';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/klima-jarvis.png'
];

// Install: statische Assets vorab cachen und sofort aktiv werden
self.addEventListener('install', event => {
    console.log('[J.A.R.V.I.S.] Service Worker installiert');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: alte Caches löschen, alle Clients übernehmen
self.addEventListener('activate', event => {
    console.log('[J.A.R.V.I.S.] Service Worker aktiviert');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name.startsWith('jarvis-') && name !== CACHE_NAME)
                    .map(name => {
                        console.log('[J.A.R.V.I.S.] Lösche alten Cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

function isStaticAsset(url) {
    const staticExtensions = /\.(html|css|js|json|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|webmanifest)$/i;
    return url.origin === self.location.origin &&
           url.pathname !== '/sw.js' &&
           (staticExtensions.test(url.pathname) || url.pathname === '/');
}

function isApi(url) {
    return url.pathname.startsWith('/api/');
}

// Fetch: Network-first für statische Assets, damit Updates sofort ankommen
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Externe und API-Requests nicht abfangen
    if (url.origin !== self.location.origin || request.method !== 'GET' || isApi(url)) {
        return;
    }

    if (!isStaticAsset(url)) {
        return;
    }

    event.respondWith(
        fetch(request, { cache: 'no-store' })
            .then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then(cached => {
                    return cached || caches.match('/index.html');
                });
            })
    );
});

// Message Handler für manuelles Update
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
