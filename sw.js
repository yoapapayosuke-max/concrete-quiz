const CACHE_NAME = 'concrete-gishi-v20260421-6';

const APP_SHELL = [
  './',
  './index.html?v=20260421-6',
  './quiz.html?v=20260421-6',
  './result.html?v=20260421-6',
  './style.css?v=20260421-6',
  './app.js?v=20260421-6',
  './questions.js?v=20260421-6',
  './mock-exam.js?v=20260421-6',
  './manifest.webmanifest'
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
        .catch(() => caches.match('./index.html?v=20260421-6'));
    })
  );
});