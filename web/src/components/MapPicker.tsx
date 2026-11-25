"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

const DepotMap = dynamic(() => import("./DepotMap"), {
    ssr: false,
    loading: () => (
        <div className="map-box map-h flex items-center justify-center text-sm text-neutral-400">Cargando mapa…</div>
    ),
});

const parse = (raw: string): number | null => {
    const n = Number(raw);
    return raw.trim() !== "" && Number.isFinite(n) ? n : null;
};

/**
 * Selector de punto en mapa. Escribe los inputs `latitude`/`longitude` del
 * formulario (los mismos que lee manualCoordinates en el servidor). El
 * marcador se fija con clic, se puede arrastrar, y los inputs editan el
 * punto a mano en ambas direcciones.
 */
export function MapPicker({
    hint = "Toca el mapa para marcar el punto (o arrastra el marcador).",
    pinLabel = "⌂",
}: {
    hint?: string;
    pinLabel?: string;
}) {
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");

    const point = useMemo<[number, number] | null>(() => {
        const la = parse(lat);
        const lo = parse(lng);
        if (la === null || lo === null || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
        return [la, lo];
    }, [lat, lng]);

    const pick = (la: number, lo: number) => {
        setLat(la.toFixed(6));
        setLng(lo.toFixed(6));
    };

    const clear = () => {
        setLat("");
        setLng("");
    };

    return (
        <div className="flex flex-col gap-2">
            <div
                className="map-box map-h"
                style={{ "--map-h": "260px", "--map-h-m": "200px" } as React.CSSProperties}
            >
                <DepotMap point={point} onPick={pick} pinLabel={pinLabel} />
            </div>
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="label">Latitud</label>
                    <input
                        name="latitude"
                        type="number"
                        step="any"
                        className="input"
                        placeholder="-17.78"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="label">Longitud</label>
                    <input
                        name="longitude"
                        type="number"
                        step="any"
                        className="input"
                        placeholder="-63.18"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                    />
                </div>
                {point && (
                    <button type="button" onClick={clear} className="btn btn-ghost px-3 py-2 text-xs text-alert whitespace-nowrap">
                        Quitar
                    </button>
                )}
            </div>
            <p className="text-[11px] text-neutral-500">{hint}</p>
        </div>
    );
}
