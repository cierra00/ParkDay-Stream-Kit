// Park Day service worker: keeps the app shell on the phone so it opens with bad park signal.
// API calls and park data always go to the network (the app handles offline saving itself).
const CACHE = "parkday-v2";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png"]))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname === "/version.json") return;
  // Network first for the page (so updates arrive), cache fallback when offline
  e.respondWith(fetch(e.request, { cache: "no-store" }).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("/"))));
});
