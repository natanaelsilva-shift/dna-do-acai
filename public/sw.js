const CACHE_NAME = "dna-admin-pwa-v1";
const ADMIN_ASSETS = [
  "/admin/pedidos",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/sounds/novo-pedido.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ADMIN_ASSETS))
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

  if (url.origin !== self.location.origin) {
    return;
  }

  const isAdminNavigation =
    request.mode === "navigate" && url.pathname.startsWith("/admin");
  const isAdminAsset = ADMIN_ASSETS.includes(url.pathname);

  if (!isAdminNavigation && !isAdminAsset) {
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

        if (isAdminNavigation) {
          return caches.match("/admin/pedidos");
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
        });
      }),
  );
});
