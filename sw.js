/**
 * Service Worker da Plataforma Gestão Pastoral - Paróquia Santa Teresa d'Ávila
 * Estratégia Network-First para arquivos da aplicação (mantendo atualizações imediatas
 * na Vercel) com fallback de cache para uso offline / PWA standalone.
 */

const CACHE_NAME = 'santa-teresa-pastoral-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/services/storage.js',
  './js/services/seedData.js',
  './js/services/dataService.js',
  './js/utils/helpers.js',
  './js/modules/dashboard.js',
  './js/modules/users.js',
  './js/modules/agenda.js',
  './js/modules/schedules.js',
  './js/modules/roles.js',
  './js/modules/forms.js',
  './js/modules/notes.js',
  './js/modules/notices.js',
  './js/modules/birthdays.js',
  './js/modules/attendance.js',
  './js/modules/responses.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))),
  );
});
