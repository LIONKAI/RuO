"use client";

import { useEffect, useState } from "react";
import { reportPosition } from "@/app/chofer/actions";

/** Reporta la posición del chofer al workday cada `intervalMs` mientras la vista esté abierta. */
export function GpsReporter({ workdayId, intervalMs = 15000 }: { workdayId: number; intervalMs?: number }) {
    const [state, setState] = useState<"off" | "on" | "error">("off");

    useEffect(() => {
        if (!navigator.geolocation) return;

        const send = (pos: GeolocationPosition) => {
            const fd = new FormData();
            fd.set("workday_id", String(workdayId));
            fd.set("latitude", String(pos.coords.latitude));
            fd.set("longitude", String(pos.coords.longitude));
            reportPosition(fd).then((r) => setState(r?.ok ? "on" : "error"));
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
