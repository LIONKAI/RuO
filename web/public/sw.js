// RuO service worker: estáticos cache-first, navegación network-first, push.
// Sin caching agresivo de HTML: la app es dinámica y multi-empresa.
const STATIC_CACHE = "ruo-static-v1";

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
    // Todo lo demás (páginas, datos): red directa, sin interferir.
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
