"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapStop } from "./DepotMap";

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
 * Mapa grande del pool de pedidos que además es el selector de punto del
 * formulario de carga. Los inputs `latitude`/`longitude` viven aquí pero se
 * asocian al formulario por el atributo `form`, así que viajan en el
 * FormData del server action aunque estén fuera del <form>. Los pedidos del
 * pool se ven como pines grises numerados; el punto pendiente es el pin azul.
 */
export function PoolPicker({ stops, formId }: { stops: MapStop[]; formId: string }) {
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

    return (
        <div className="flex flex-col gap-2">
            <div className="map-box map-h" style={{ "--map-h": "520px", "--map-h-m": "300px" } as React.CSSProperties}>
                <DepotMap point={point} onPick={pick} pinLabel="+" stops={stops} />
            </div>
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="label">Latitud</label>
                    <input
                        form={formId}
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
                        form={formId}
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
                    <button
                        type="button"
                        onClick={() => {
                            setLat("");
                            setLng("");
                        }}
                        className="btn btn-ghost px-3 py-2 text-xs text-alert whitespace-nowrap"
                    >
                        Quitar
                    </button>
                )}
            </div>
            <p className="text-[11px] text-neutral-500">
                {point
                    ? "Punto marcado — arrastra el pin + para afinarlo, o toca otro lugar."
                    : "Toca el mapa donde es la entrega (opcional). Los pines grises son pedidos ya en el pool."}
            </p>
        </div>
    );
}
