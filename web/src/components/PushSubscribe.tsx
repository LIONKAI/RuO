"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Activa notificaciones push en este dispositivo. Si el permiso ya fue
 * concedido, sincroniza la suscripción silenciosamente; si no, muestra un
 * botón discreto para pedirlo. Renderiza null cuando no hay soporte.
 */
export function PushSubscribe({ vapidKey, hint }: { vapidKey: string | undefined; hint: string }) {
    const [state, setState] = useState<"loading" | "prompt" | "on" | "off" | "unsupported">("loading");

    useEffect(() => {
        // Detección en microtask: el primer render siempre es "loading" (null),
        // así no hay setState síncrono en el cuerpo del efecto.
        let cancelled = false;
        queueMicrotask(async () => {
            if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
                if (!cancelled) setState("unsupported");
                return;
            }
            if (Notification.permission === "denied") {
                if (!cancelled) setState("off");
                return;
            }
            if (Notification.permission !== "granted") {
                if (!cancelled) setState("prompt");
                return;
            }
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub =
                    (await reg.pushManager.getSubscription()) ??
                    (await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidKey),
                    }));
                await fetch("/api/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(sub.toJSON()),
                });
                if (!cancelled) setState("on");
            } catch {
                if (!cancelled) setState("prompt");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [vapidKey]);

    if (state !== "prompt") return null;

    const enable = async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setState("off");
                return;
            }
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey!),
            });
            await fetch("/api/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sub.toJSON()),
            });
            setState("on");
        } catch {
            setState("off");
        }
    };

    return (
        <button type="button" onClick={enable} className="border border-ruo-200 bg-ruo-50 px-3 py-2 text-xs text-ruo-700">
            🔔 {hint}
        </button>
    );
}
