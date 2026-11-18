"use client";

import { useEffect, useRef, useState } from "react";
import { reportPosition } from "@/app/chofer/actions";

/**
 * Reporta la posición del chofer al workday como máximo una vez cada
 * `intervalMs` mientras la vista esté abierta. watchPosition puede disparar
 * varias veces por segundo; sin este límite cada lectura sería una invocación
 * de función en Vercel.
 */
export function GpsReporter({ workdayId, intervalMs = 15000 }: { workdayId: number; intervalMs?: number }) {
    const [state, setState] = useState<"off" | "on" | "error">("off");
    const lastSentAt = useRef(0);
    const sending = useRef(false);

    useEffect(() => {
        if (!navigator.geolocation) return;

        const send = (pos: GeolocationPosition) => {
            const now = Date.now();
            if (sending.current || now - lastSentAt.current < intervalMs) return;

            sending.current = true;
            lastSentAt.current = now;

            const fd = new FormData();
            fd.set("workday_id", String(workdayId));
            fd.set("latitude", String(pos.coords.latitude));
            fd.set("longitude", String(pos.coords.longitude));

            reportPosition(fd)
                .then((r) => setState(r?.ok ? "on" : "error"))
                .catch(() => setState("error"))
                .finally(() => {
                    sending.current = false;
                });
        };

        const watch = navigator.geolocation.watchPosition(send, () => setState("error"), {
            enableHighAccuracy: true,
            maximumAge: intervalMs,
        });

        return () => navigator.geolocation.clearWatch(watch);
    }, [workdayId, intervalMs]);

    return (
        <span className={`tag ${state === "on" ? "tag-done" : state === "error" ? "tag-alert" : "tag-outline"}`}>
            <span className={`inline-block size-1.5 rounded-full ${state === "on" ? "live-dot bg-done" : "bg-neutral-400"}`} />
            GPS {state === "on" ? "transmitiendo" : state === "error" ? "sin señal" : "…"}
        </span>
    );
}
