const CACHE_NAME = 'cakrawala-pos-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network first, cache fallback
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip API calls (let them go to network)
    if (event.request.url.includes('/api/')) return;
    
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Return cached version if offline
                return caches.match(event.request).then((cached) => {
                    return cached || caches.match('/');
                });
            })
    );
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncTransactions());
    }
});

async function syncTransactions() {
    // Notify clients to sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
        client.postMessage({ type: 'SYNC_TRANSACTIONS' });
    });
}
