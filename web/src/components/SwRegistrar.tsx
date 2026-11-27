"use client";

import { useEffect } from "react";

/** Registra el service worker una vez por sesión. No bloquea ni muestra UI. */
export function SwRegistrar() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
        if (document.readyState === "complete") register();
        else window.addEventListener("load", register, { once: true });
    }, []);
    return null;
}
