const CACHE_NAME = 'concrete-gishi-v20260518-3';

const APP_SHELL = [
  '/concrete-quiz/',
  '/concrete-quiz/index.html',
  '/concrete-quiz/quiz.html',
  '/concrete-quiz/result.html',
  '/concrete-quiz/style.css?v=20260518-3',
  '/concrete-quiz/app.js?v=20260518-3',
  '/concrete-quiz/questions.js?v=20260518-3',
  '/concrete-quiz/mock-exam.js?v=20260518-3',
  '/concrete-quiz/manifest.webmanifest',
  '/concrete-quiz/icon-192.png',
  '/concrete-quiz/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // HTML/JS/CSSはネット優先。古いデータ残りを防ぐ。
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/concrete-quiz/index.html')))
  );
});
