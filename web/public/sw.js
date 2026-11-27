// RuO service worker: estáticos cache-first, navegación network-first, push.
// Sin caching agresivo de HTML: la app es dinámica y multi-empresa.
const STATIC_CACHE = "ruo-static-v1";
const TILE_CACHE = "ruo-tiles-v1";
const PAGE_CACHE = "ruo-pages-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/icon-192.png", "/icon-512.png"])),
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
        ).then(() => self.clients.claim()),
    );
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    // Tiles del mapa: cache-first — sin esto el mapa muere sin señal en la calle.
    if (url.hostname.endsWith("tile.openstreetmap.org")) {
        event.respondWith(
            caches.open(TILE_CACHE).then(async (cache) => {
                const hit = await cache.match(event.request);
                if (hit) return hit;
                try {
                    const res = await fetch(event.request);
                    if (res.ok) {
                        cache.put(event.request, res.clone());
                        // Cap simple: si crece mucho, se limpia el cache entero.
                        const keys = await cache.keys();
                        if (keys.length > 800) await cache.delete(keys[0]);
                    }
                    return res;
                } catch {
                    return hit ?? Response.error();
                }
            }),
        );
        return;
    }

    if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

    // Assets de build y estáticos: cache-first (son inmutables por hash).
    if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon-")) {
        event.respondWith(
            caches.match(event.request).then(
                (hit) =>
                    hit ??
                    fetch(event.request).then((res) => {
                        if (res.ok) {
                            const copy = res.clone();
                            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
                        }
                        return res;
                    }),
            ),
        );
    }
    // Páginas de la app: network-first con fallback al cache — el chofer puede
    // reabrir su ruta sin señal con el último estado cargado.
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request)
                .then((res) => {
                    if (res.ok && url.pathname.startsWith("/chofer")) {
                        const copy = res.clone();
                        caches.open(PAGE_CACHE).then((cache) => cache.put(event.request, copy));
                    }
                    return res;
                })
                .catch(async () => {
                    const hit = await caches.match(event.request);
                    return hit ?? Response.error();
                }),
        );
    }
});

// --- Push notifications ---
self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: event.data ? event.data.text() : "RuO" };
    }
    event.waitUntil(
        self.registration.showNotification(data.title || "RuO", {
            body: data.body || "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: data.tag || "ruo",
            data: { url: data.url || "/" },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (new URL(client.url).pathname === url && "focus" in client) return client.focus();
            }
            return self.clients.openWindow(url);
        }),
    );
});
