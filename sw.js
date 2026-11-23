// Service worker : l'appli s'ouvre sans réseau ; avec réseau, elle prend toujours la dernière version.
const CACHE = "liste-de-course-v8";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Page : réseau d'abord (3 s max), sinon la copie hors ligne.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req, { cache: "no-store" }), new Promise((_, rej) => setTimeout(() => rej(new Error("lent")), 3000))]);
        if (res && res.ok) { cache.put("./index.html", res.clone()); return res; }
      } catch (err) {}
      return (await cache.match("./index.html")) || (await cache.match("./")) || new Response("Hors ligne", { status: 503 });
    })());
    return;
  }
  // Autres fichiers : cache d'abord, mis à jour en arrière-plan.
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || new Response("", { status: 504 });
  }));
});
