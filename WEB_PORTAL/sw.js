// Service Worker for K-Cine PWA installability and static shell caching
const CACHE_NAME = 'kcine-shell-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/icons/kcine-favicon.png',
  '/icons/kcine-app-128.png',
  '/icons/kcine-app-180.png',
  '/icons/kcine-app-192.png',
  '/icons/kcine-app-512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/manifest.json',
  '/manifest.webmanifest',
  '/img/kcine-logo-transparent.png'
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
