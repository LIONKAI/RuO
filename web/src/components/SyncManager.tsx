"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { drainQueue, onQueueChange, pendingCount } from "@/lib/offline-queue";

/**
 * Vigila la cola offline del chofer: la vacía cuando vuelve la señal y cada
 * 60s como red de seguridad, y muestra un badge mientras haya entregas
 * guardadas localmente sin sincronizar.
 */
export function SyncManager() {
    const router = useRouter();
    const [pending, setPending] = useState(0);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        let mounted = true;

        const refresh = async () => {
            const n = await pendingCount();
            if (mounted) setPending(n);
        };

        const sync = async () => {
            setSyncing(true);
            const before = await pendingCount();
            const after = await drainQueue();
            if (mounted) {
                setPending(after);
                setSyncing(false);
                // Si se vació algo, la ruta cambió en el servidor: refrescar.
                if (after < before) router.refresh();
            }
        };

        refresh();
        const offListener = onQueueChange(refresh);
        const onOnline = () => sync();
        window.addEventListener("online", onOnline);
        const interval = setInterval(sync, 60_000);
        sync(); // intento inicial por si quedaron de una sesión anterior

        return () => {
            mounted = false;
            offListener();
            window.removeEventListener("online", onOnline);
            clearInterval(interval);
        };
    }, [router]);

    if (pending === 0) return null;

    return (
        <div className="mb-4 border border-ruo-300 bg-ruo-100 px-3 py-2 text-xs text-ruo-800">
            {syncing
                ? "⟳ Sincronizando entregas guardadas…"
                : `⏳ ${pending} entrega${pending > 1 ? "s" : ""} guardada${pending > 1 ? "s" : ""} en el teléfono — se enviará${pending > 1 ? "n" : ""} sola${pending > 1 ? "s" : ""} al recuperar señal.`}
        </div>
    );
}
