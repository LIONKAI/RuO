"use client";

import dynamic from "next/dynamic";
import type { MapStop } from "./Map";

// Leaflet necesita window — se carga solo en cliente.
export const RouteMap = dynamic(() => import("./Map").then((m) => m.RouteMap), {
    ssr: false,
    loading: () => <div className="map-box flex items-center justify-center text-sm text-neutral-400" style={{ height: 340 }}>Cargando mapa…</div>,
});

export type { MapStop };
