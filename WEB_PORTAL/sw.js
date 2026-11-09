// Service Worker for K-Cine PWA installability and static shell caching
const CACHE_NAME = 'kcine-shell-v66';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html?v=66',
  '/style.css?v=66',
  '/app.js?v=66',
  '/icons/kcine-favicon.png?v=66',
  '/icons/kcine-app-128.png?v=66',
  '/icons/kcine-app-180.png?v=66',
  '/icons/kcine-app-192.png?v=66',
  '/icons/kcine-app-512.png?v=66',
  '/apple-touch-icon.png?v=66',
  '/apple-touch-icon-precomposed.png?v=66',
  '/manifest.json?v=66',
  '/manifest.webmanifest?v=66'
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
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Apenas intercepta requisições locais de mesma origem (shell estático da aplicação)
  // Deixa CDNs externas de imagens (TMDB, Unsplash) e streams de vídeo rodarem nativamente no navegador
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }
  // Let network handle dynamic API/data streams directly to avoid caching stale streams
  if (e.request.url.includes('/api/') || e.request.url.includes('/data/') || e.request.url.includes('worker')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
