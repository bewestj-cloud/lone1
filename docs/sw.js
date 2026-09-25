// Naamlys offline support.
// Every file the app needs is saved on the phone at install, so it opens with no signal.
// Bump VERSION whenever any file in this folder changes so phones fetch the new copy.
const VERSION = 'naamlys-v3';
const FILES = [
  './', './index.html', './manifest.webmanifest', './xlsx.full.min.js',
  './icon-192.png', './icon-512.png',
  './fonts/chakra-petch-latin-400-normal.woff2', './fonts/chakra-petch-latin-500-normal.woff2',
  './fonts/chakra-petch-latin-600-normal.woff2', './fonts/chakra-petch-latin-700-normal.woff2',
  './fonts/jetbrains-mono-latin-400-normal.woff2', './fonts/jetbrains-mono-latin-500-normal.woff2',
  './fonts/jetbrains-mono-latin-700-normal.woff2', './fonts/jetbrains-mono-latin-800-normal.woff2',
];

async function tellPages(msg) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg);
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k.startsWith('naamlys-') && k !== VERSION);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    tellPages(old.length ? 'updated' : 'offline-ready');
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return; // register links (Dropbox) always use the network

  // Serve from the phone straight away (instant, works with no signal),
  // then refresh the saved copy in the background when there is signal.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const refresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => undefined);
    if (cached) { e.waitUntil(refresh); return cached; }
    return (await refresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
