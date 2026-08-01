/**
 * J.A.R.V.I.S. Service Worker
 * Network-first für statische Assets, damit Updates sofort sichtbar sind.
 * Mit Offline-Fallback für API-Requests (cached letzte erfolgreiche Response).
 */

const CACHE_NAME = 'jarvis-v37';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/klima-jarvis.png'
];

// API-Responses für Offline-Fallback cachen (max 10 letzte)
const API_CACHE_NAME = 'jarvis-api-cache';
const MAX_API_CACHE_SIZE = 10;

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

// Fetch: Network-first für statische Assets, Cache-First für API mit Offline-Fallback
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Nur GET-Requests von derselben Origin
    if (url.origin !== self.location.origin || request.method !== 'GET') {
        return;
    }

    // API-Requests: Cache-First mit Network-Fallback
    if (isApi(url)) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    // Cached Response zurückgeben, im Hintergrund aktualisieren
                    fetch(request, { cache: 'no-store' }).then(response => {
                        if (response && response.status === 200) {
                            cacheApiResponse(request, response.clone());
                        }
                    }).catch(() => {
                        // Network failed, cached response already returned
                    });
                    return cached;
                }

                // Nicht im Cache, von Network holen
                return fetch(request, { cache: 'no-store' }).then(response => {
                    if (response && response.status === 200) {
                        cacheApiResponse(request, response.clone());
                    }
                    return response;
                }).catch(() => {
                    // Offline: Fallback Response
                    return new Response(
                        JSON.stringify({
                            error: 'offline',
                            message: 'Keine Netzwerkverbindung. Bitte versuchen Sie es später.',
                            cached: false
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                });
            })
        );
        return;
    }

    // Statische Assets: Network-first
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

// Hilfsfunktion: API-Response mit Größenlimit cachen
async function cacheApiResponse(request, response) {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        
        // Cache-Größe prüfen und alte Einträge löschen
        const keys = await cache.keys();
        if (keys.length >= MAX_API_CACHE_SIZE) {
            // Ältesten Eintrag löschen
            await cache.delete(keys[0]);
        }
        
        await cache.put(request, response);
    } catch (error) {
        console.warn('[J.A.R.V.I.S.] API-Cache fehlgeschlagen:', error);
    }
}

// Message Handler für manuelles Update
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
