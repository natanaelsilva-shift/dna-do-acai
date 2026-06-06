const CACHE_NAME = "dna-acai-pwa-v2";
const PRECACHE_ASSETS = [
  "/",
  "/admin/pedidos",
  "/manifest.json",
  "/admin-manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
  "/images/logo-dna-acai.png",
  "/images/og-dna-acai.png",
  "/sounds/novo-pedido.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  const isPrecachedAsset = PRECACHE_ASSETS.includes(url.pathname);
  const isStaticAsset = ["image", "style", "script", "font", "audio"].includes(
    request.destination,
  );

  if (!isNavigation && !isPrecachedAsset && !isStaticAsset) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseToCache = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, responseToCache))
          .catch(() => undefined);

        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        if (isNavigation) {
          return url.pathname.startsWith("/admin")
            ? caches.match("/admin/pedidos")
            : caches.match("/");
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
        });
      }),
  );
});
