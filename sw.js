const CACHE_NAME = 'concrete-gishi-v20260421-8';

const APP_SHELL = [
  '/icon/',
  '/icon/index.html',
  '/icon/quiz.html',
  '/icon/result.html',
  '/icon/style.css?v=20260421-6',
  '/icon/app.js?v=20260421-6',
  '/icon/questions.js?v=20260421-6',
  '/icon/mock-exam.js?v=20260421-6',
  '/icon/manifest.webmanifest',
  '/icon/icon-192.png',
  '/icon/icon-512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});