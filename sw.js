/* © cygna.co - cygna.consult | Service worker for cygna_mls202pathology (offline support) */
const CACHE = "cygna_mls202pathology-v1";
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const SHELL = ["./", "index.html", "style.css", "app.js", "questions.js", "supabase-config.js",
  "admin.html", "admin.js", "manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((u) => c.add(u)));
    try { await c.add(new Request(CDN, { mode: "no-cors" })); } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache Supabase API / auth calls
  if (url.hostname.endsWith("supabase.co")) return;

  // Supabase JS CDN: cache-first
  if (req.url === CDN) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r;
    })));
    return;
  }

  if (url.origin !== location.origin) return;

  // Pages: network first, fall back to cache (so updates show up, offline still works)
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => {
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))));
    return;
  }

  // Static files: stale-while-revalidate
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => {
      if (r && r.status === 200) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
