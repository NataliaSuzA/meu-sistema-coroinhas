/**
 * Service Worker v25 — Gestão Pastoral - Paróquia Santa Teresa d'Ávila (Cloud Firestore)
 */

const CACHE_NAME = 'santa-teresa-pastoral-v25';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/services/firebaseConfig.js',
  './js/services/authService.js',
  './js/services/storage.js',
  './js/services/seedData.js',
  './js/services/dataService.js',
  './js/services/availabilityService.js',
  './js/services/eucharisticPrayers.js',
  './js/services/liturgyService.js',
  './js/utils/helpers.js',
  './js/modules/profile.js',
  './js/modules/permissions.js',
  './js/modules/myDates.js',
  './js/modules/liturgy.js',
  './js/modules/locations.js',
  './js/modules/celebrationTypes.js',
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
  // Nunca intercepta rotas de API Serverless (`/api/...`) no cache estático do Service Worker
  if (url.pathname.startsWith('/api/')) return;

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
