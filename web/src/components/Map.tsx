"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapStop {
    latitude: number;
    longitude: number;
    label?: string;
    status?: "pending" | "completed" | "failed" | "depot";
}

const markerIcon = (stop: MapStop, index: number) => {
    const color = stop.status === "completed" ? "#27ae60"
        : stop.status === "failed" ? "#e67e22"
        : stop.status === "depot" ? "#1e3a5f"
        : "#2f6496";
    const text = stop.status === "depot" ? "⌂" : stop.status === "completed" ? "✓" : stop.status === "failed" ? "✕" : String(index + 1);
    return L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:${color};border:2px solid #fff;color:#fff;font:700 12px 'Barlow Condensed',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);">${text}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
    });
};

function FitBounds({ points }: { points: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length > 0) {
            map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
        }
    }, [map, points]);
    return null;
}

const CENTER: [number, number] = [-17.7833, -63.1821]; // Santa Cruz

export function RouteMap({
    stops,
    geometry,
    live,
    height = 340,
}: {
    stops: MapStop[];
    geometry?: [number, number][] | null;
    live?: { latitude: number; longitude: number } | null;
    height?: number;
}) {
    const points: [number, number][] = [
        ...stops.map((s) => [s.latitude, s.longitude] as [number, number]),
        ...(live ? [[live.latitude, live.longitude] as [number, number]] : []),
        ...(geometry ?? []),
    ];

    return (
        <div className="map-box" style={{ height }}>
            <MapContainer center={points[0] ?? CENTER} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geometry && <Polyline positions={geometry} color="#2f6496" weight={4} opacity={0.8} />}
                {stops.map((stop, i) => (
                    <Marker key={i} position={[stop.latitude, stop.longitude]} icon={markerIcon(stop, i)} title={stop.label} />
                ))}
                {live && (
                    <Marker
                        position={[live.latitude, live.longitude]}
                        icon={L.divIcon({
                            className: "",
                            html: '<div style="width:16px;height:16px;border-radius:50%;background:#2f6496;border:3px solid #fff;box-shadow:0 0 0 4px rgba(47,100,150,.35);"></div>',
                            iconSize: [16, 16],
                            iconAnchor: [8, 8],
                        })}
                    />
                )}
                <FitBounds points={points} />
            </MapContainer>
        </div>
    );
}
