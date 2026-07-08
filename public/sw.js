/**
 * J.A.R.V.I.S. Service Worker
 * Für Offline-Fähigkeit und schnelles Laden
 */

const CACHE_NAME = 'jarvis-v2';
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
    console.log('[J.A.R.V.I.S.] Service Worker installiert');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.log('[J.A.R.V.I.S.] Cache-Fehler:', err);
            })
    );
    
    // Sofort aktivieren
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
    console.log('[J.A.R.V.I.S.] Service Worker aktiviert');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
    // Nur Anfragen an die eigene Domain abfangen. Externe APIs (Hermes/ngrok)
    // sollen immer direkt gefetcht werden, damit CORS und Tokens funktionieren.
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit
                if (response) {
                    return response;
                }
                
                // Netzwerk-Anfrage
                return fetch(event.request)
                    .then(response => {
                        // Nur valid Responses cachen
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Response klonen (kann nur einmal gelesen werden)
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    });
            })
            .catch(() => {
                // Offline-Fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});
