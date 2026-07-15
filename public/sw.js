/**
 * J.A.R.V.I.S. Service Worker
 * Für Offline-Fähigkeit und schnelles Laden
 */

const CACHE_NAME = 'jarvis-v14';
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
    console.log('[J.A.R.V.I.S.] Service Worker v4 installiert');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            // Alle alten Jarvis-Caches löschen, inklusive v3
            return Promise.all(
                cacheNames
                    .filter(name => name.startsWith('jarvis-'))
                    .map(name => {
                        console.log('[J.A.R.V.I.S.] Lösche alten Cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => caches.open(CACHE_NAME))
          .then(cache => cache.addAll(urlsToCache))
    );
    
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
    console.log('[J.A.R.V.I.S.] Service Worker v4 aktiviert');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name.startsWith('jarvis-'))
                    .map(name => {
                        console.log('[J.A.R.V.I.S.] Lösche alten Cache beim Aktivieren:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Nur statische GET-Assets cachen, API-Calls ignorieren
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Externe Requests nicht abfangen
    if (url.origin !== self.location.origin) {
        return;
    }
    
    // API-Requests und Nicht-GET niemals abfangen
    if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        return;
    }
    
    // Nur statische Assets cachen
    const staticExtensions = /\.(html|css|js|json|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)$/i;
    if (!staticExtensions.test(url.pathname) && url.pathname !== '/') {
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

// Sofort auf Updates reagieren
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
