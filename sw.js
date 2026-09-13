const CACHE_NAME = 'rey-david-shell-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// 1. INSTALLATION: Cache the App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching App Shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

// 2. ACTIVATION: Clean up old caches if we update the app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCHING: Stale-While-Revalidate for the App Shell ONLY
// Serves cached shell instantly (fast repeat loads), then refreshes the cache in the background.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only let the Service Worker touch your local files!
  // If the request is going to Google Apps Script, YouTube, or an external API, ignore it completely.
  if (url.origin !== location.origin) {
    return; 
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cachedResponse);
        return cachedResponse || networkFetch;
      });
    })
  );
});
