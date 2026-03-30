// Service Worker for OneCore Offset Pro
const CACHE_NAME = 'onecore-offset-pro-v1';
const urlsToCache = [
  '/OneCore-offset-Pro/',
  '/OneCore-offset-Pro/index.html',
  '/OneCore-offset-Pro/style.css',
  '/OneCore-offset-Pro/script.js',
  '/OneCore-offset-Pro/elf-parser.js',
  '/OneCore-offset-Pro/string-extractor.js',
  '/OneCore-offset-Pro/offset-finder.js',
  '/OneCore-offset-Pro/ai-detector.js',
  '/OneCore-offset-Pro/level-detector.js',
  '/OneCore-offset-Pro/export.js',
  '/OneCore-offset-Pro/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
