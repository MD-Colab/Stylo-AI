const CACHE_NAME = 'fuma-invoice-v1';
const ASSETS = [
  './',
  './index.html',
  './responsive.css',
  './shared.css',
  './shared.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((fetchRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request.url, fetchRes.clone());
          return fetchRes;
        });
      });
    }).catch(() => caches.match('./index.html'))
  );
});
