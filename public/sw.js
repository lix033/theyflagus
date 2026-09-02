/* Flag It — service worker : coquille applicative disponible hors ligne. */

const VERSION = "flagit-v1";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== SHELL && key !== RUNTIME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Navigation : réseau d'abord, cache en secours (application utilisable hors ligne). */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      void caches
        .open(SHELL)
        .then((cache) => cache.put("/", copy))
        .catch(() => undefined);
    }
    return response;
  } catch {
    const cached = (await caches.match(request)) || (await caches.match("/"));
    if (cached) return cached;
    return new Response("Hors ligne", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** Ressources statiques : cache d'abord, rafraîchi en arrière-plan. */
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) {
    void fetch(request)
      .then((response) => {
        if (response && response.ok) {
          return caches.open(RUNTIME).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => undefined);
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    const copy = response.clone();
    const cache = await caches.open(RUNTIME);
    await cache.put(request, copy).catch(() => undefined);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|png|svg|webp|woff2?|ico)$/.test(url.pathname);

  if (isAsset) event.respondWith(handleAsset(request));
});
