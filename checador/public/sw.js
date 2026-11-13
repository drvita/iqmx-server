const CACHE_VERSION = "iqmx-checador-kiosk-v2";
const PRECACHE_URLS = [
  "/kiosk",
  "/icons/kiosk-icon.svg",
  "/models/det_500m.onnx",
  "/models/2.7_80x80_MiniFASNetV2.onnx",
  "/models/w600k_mbf.onnx",
  "/ort/ort-wasm-simd-threaded.mjs",
  "/ort/ort-wasm-simd-threaded.wasm",
  "/ort/ort-wasm-simd-threaded.jsep.mjs",
  "/ort/ort-wasm-simd-threaded.jsep.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      for (const url of PRECACHE_URLS) {
        try {
          await cache.add(url);
        } catch {
          // Si algún archivo opcional falla en dev, no bloquear la instalación
        }
      }
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })
  );
});

function isImmutableAsset(pathname) {
  return (
    pathname.startsWith("/models/") ||
    pathname.startsWith("/ort/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/api/branding/logo/")
  );
}

function isNetworkFirstOfflineAsset(req, pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/kiosk") ||
    (req.mode === "navigate" && pathname.startsWith("/kiosk"))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/sync/") ||
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.startsWith("/api/admin/")
  ) {
    return;
  }

  if (isImmutableAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  if (isNetworkFirstOfflineAsset(req, url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === "navigate") {
            const fallback = await caches.match("/kiosk");
            if (fallback) return fallback;
          }
          return new Response("Sin conexión", { status: 503 });
        })
    );
  }
});
