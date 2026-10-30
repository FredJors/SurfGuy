/*
 * Service Worker: SurfGuy auch offline spielbar (z. B. als App auf dem iPad-Homescreen).
 * Die Seite selbst kommt immer zuerst aus dem Netz (neueste Version) und nur ohne Netz aus dem
 * Zwischenspeicher. Icons und Manifest kommen aus dem Zwischenspeicher.
 */
const CACHE = 'surfguy-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function store(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    // Seite: Netz zuerst (ohne URL-Parameter speichern), sonst gespeicherte Version
    const key = new Request(url.origin + url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => store(key, res))
        .catch(() => caches.match(key).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  event.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => store(req, res))));
});
