const CACHE_NAME = "dna-acai-pwa-v6";
const PRECACHE_ASSETS = ["/offline.html", "/manifest.json", "/admin-manifest.json", "/favicon.ico", "/icons/icon-192.png", "/icons/icon-512.png", "/apple-touch-icon.png", "/images/logo-dna-acai.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("dna-acai-pwa-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("range") ||
    url.pathname.startsWith("/api/") || request.headers.has("rsc") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") {
    // HTML e dados administrativos nunca são persistidos, inclusive após logout.
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) ||
      new Response("Sem conexão. Reconecte para continuar.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/_next/") ||
    !["image", "font", "audio"].includes(request.destination) && !PRECACHE_ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.status !== 206 && !/no-store|private/i.test(response.headers.get("cache-control") || "")) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || new Response("Offline", { status: 503 })));
});
