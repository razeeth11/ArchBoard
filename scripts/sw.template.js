/* ArchBoard service worker (generated into out/sw.js by scripts/build-pwa.mjs).
 * Offline strategy: the app shell and every build asset are precached at install; navigations are
 * network-first with a cached fallback; icons, previews and editor assets are cache-first at runtime.
 * It never caches user data (that lives in IndexedDB) and never touches cross-origin requests. */
const VERSION = "__VERSION__";
const PRECACHE = `archboard-precache-${VERSION}`;
const RUNTIME = "archboard-runtime-v1";
const ASSETS = __ASSETS__;
const PAGES = __PAGES__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Pages first (small), then assets; one failure must not abort the whole install.
      await Promise.allSettled(
        [...PAGES, ...ASSETS].map((u) => cache.add(new Request(u, { cache: "reload" }))),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k.startsWith("archboard-precache-") && k !== PRECACHE) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isRuntimeAsset = (p) =>
  p === "/icon.svg" ||
  p === "/manifest.webmanifest" ||
  p.startsWith("/excalidraw-assets/") ||
  p.startsWith("/icons/") ||
  p.startsWith("/previews/") ||
  p.startsWith("/_next/static/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && url.pathname !== "/sw.js") {
            const c = await caches.open(RUNTIME);
            c.put(url.pathname, res.clone()); // query strings (?scene=) share one shell
          }
          return res;
        } catch {
          return (
            (await caches.match(url.pathname, { ignoreSearch: true })) ||
            (await caches.match("/app", { ignoreSearch: true })) ||
            new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
          );
        }
      })(),
    );
    return;
  }

  if (isRuntimeAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
        return res;
      })(),
    );
  }
});
