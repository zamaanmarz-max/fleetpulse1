// MARZ Fleet service worker — minimal, network-first.
// Its presence (plus the manifest) is what makes the app installable.
// Bump CACHE on every meaningful change so the activate step below purges
// old caches. The version string is also what lets the app prompt users to
// refresh when a new deploy is live (see src/registerSW.ts).
const CACHE = "marz-fleet-v2";

self.addEventListener("install", () => {
  // NOTE: we intentionally do NOT call skipWaiting() here. A freshly deployed
  // worker waits until the user taps "Refresh" (or reopens the app) so we never
  // yank the page out from under someone mid-form. The app messages us with
  // { type: "SKIP_WAITING" } when the user opts in.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try the live app, fall back to cache only if offline.
// We never cache API/Supabase calls — those must always be fresh.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.hostname.includes("supabase") || url.pathname.includes("/api/") || url.hostname.includes("anthropic")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
