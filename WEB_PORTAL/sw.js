// Service Worker for K-Cine PWA installability and static shell caching
const CACHE_NAME = 'kcine-shell-v32';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html?v=32',
  '/style.css?v=32',
  '/app.js?v=32',
  '/icons/kcine-favicon.png?v=32',
  '/icons/kcine-app-128.png?v=32',
  '/icons/kcine-app-180.png?v=32',
  '/icons/kcine-app-192.png?v=32',
  '/icons/kcine-app-512.png?v=32',
  '/apple-touch-icon.png?v=32',
  '/apple-touch-icon-precomposed.png?v=32',
  '/manifest.json?v=32',
  '/manifest.webmanifest?v=32'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => { });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Let network handle API/streaming requests normally
  if (e.request.url.includes('/api/') || e.request.url.includes('/stream') || e.request.method !== 'GET') {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
