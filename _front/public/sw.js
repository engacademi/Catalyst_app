// Offline shell for venue Wi-Fi (R-27). Keeps visited public pages and the static assets
// they need so a reload without a connection still renders. API responses are never
// cached here: the app saves public event data itself and labels it with its saved time,
// and staff/account requests carry credentials that must not land in a shared cache.
const VERSION = "v1";
const PAGES = `catalyst-pages-${VERSION}`;
const ASSETS = `catalyst-assets-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

// Pages that render account state (Clerk) or staff tools stay network-only.
const PRIVATE_PAGES = /^\/($|admin|profile|officials|sign-in|sign-up)/;

const OFFLINE_HTML = `<!doctype html><html lang="en-CA"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Olley Catalyst</title>
<style>body{font-family:system-ui,sans-serif;background:#f3f5f1;color:#1d332b;margin:0;padding:48px 20px;text-align:center}
a{color:#164c3b;font-weight:700}</style></head><body><h1>You're offline</h1>
<p>This page hasn't been saved on this device yet. It will load when you reconnect.</p>
<p><a href="/schedule">Open My Schedule</a> · <a href="/tournaments">Tournaments</a></p></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (![PAGES, ASSETS].includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

function isPublicPage(url) {
  return url.origin === self.location.origin && !PRIVATE_PAGES.test(url.pathname);
}

function isAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/_next/image") ||
      /\.(png|jpe?g|svg|webp|ico|woff2?)$/.test(url.pathname))
  );
}

function pageKey(url) {
  const key = new URL(url);
  key.hash = "";
  return key.href;
}

async function savePage(url) {
  const target = new URL(url);
  if (!isPublicPage(target)) return;
  const response = await fetch(target.href, { credentials: "same-origin" });
  if (response.ok && response.type === "basic")
    await (await caches.open(PAGES)).put(pageKey(target), response);
}

async function saveAsset(url) {
  const target = new URL(url);
  if (!isAsset(target)) return;
  const cache = await caches.open(ASSETS);
  if (await cache.match(target.href)) return;
  const response = await fetch(target.href);
  if (response.ok) await cache.put(target.href, response);
}

// The page that registers the worker loaded its scripts before the worker existed, and
// client-side navigations fetch RSC payloads rather than HTML. The page therefore tells
// the worker which URL it is on and which assets it used.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "save-page") return;
  event.waitUntil(
    Promise.allSettled([
      savePage(data.url),
      ...(data.assets ?? []).map(saveAsset),
    ]).then(() => event.ports[0]?.postMessage("saved")),
  );
});

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS),
      ),
    ]);
    if (response.ok && response.type === "basic" && isPublicPage(url))
      await cache.put(pageKey(url), response.clone());
    return response;
  } catch {
    const saved =
      (await cache.match(pageKey(url))) ??
      (await cache.match(pageKey(url), { ignoreSearch: true, ignoreVary: true }));
    return saved ?? offlinePage();
  }
}

function offlinePage() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request, { ignoreVary: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API traffic, RSC payloads and the worker itself go straight to the network.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      isPublicPage(url)
        ? networkFirstPage(request)
        : fetch(request).catch(() => offlinePage()),
    );
    return;
  }
  if (isAsset(url)) event.respondWith(cacheFirstAsset(request));
});
