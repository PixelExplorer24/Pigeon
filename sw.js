const CACHE = 'digital-pigeon-static-v3';
const STATIC = [
  './',
  './index.html',
  './404.html',
  './assets/css/app.css',
  './assets/js/tailwind.config.js',
  './assets/js/app.js',
  './assets/js/lazy-mapbox.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match('./index.html'))));
});
