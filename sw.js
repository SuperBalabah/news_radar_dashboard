const CACHE_NAME = 'news-radar-v8';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install event: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: network first strategy for data and reports, cache first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Cache static assets first, network fallback
  if (STATIC_ASSETS.some(asset => event.request.url.includes(asset.replace('./', '')))) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        return cachedResponse || fetch(event.request);
      })
    );
    return;
  }
  
  // Data and reports: network first, fallback to cache
  event.respondWith(
    fetch(event.request).then(response => {
      // Only cache valid successful GET requests
      if (response.status === 200 && event.request.method === 'GET') {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
          // If request had a cache-busting query string (e.g. data.json?_t=...), also store under base path
          if (url.search && (url.pathname.endsWith('data.json') || url.pathname.endsWith('.md'))) {
            cache.put(new Request(url.pathname), responseClone.clone());
          }
        });
      }
      return response;
    }).catch(() => {
      // Offline fallback: try cache (ignoring query params)
      return caches.match(event.request, { ignoreSearch: true });
    })
  );
});
