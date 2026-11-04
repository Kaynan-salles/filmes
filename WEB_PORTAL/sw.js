// Service Worker for K-Cine PWA installability and static shell caching
const CACHE_NAME = 'kcine-shell-v30';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html?v=30',
  '/style.css?v=30',
  '/app.js?v=30',
  '/icons/kcine-favicon.png?v=30',
  '/icons/kcine-app-128.png?v=30',
  '/icons/kcine-app-180.png?v=30',
  '/icons/kcine-app-192.png?v=30',
  '/icons/kcine-app-512.png?v=30',
  '/apple-touch-icon.png?v=30',
  '/apple-touch-icon-precomposed.png?v=30',
  '/manifest.json?v=30',
  '/manifest.webmanifest?v=30'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
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
