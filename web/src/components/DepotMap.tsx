"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CENTER: [number, number] = [-17.7833, -63.1821]; // Santa Cruz

const pinIcon = (label: string) => L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#1e3a5f;border:2px solid #fff;color:#fff;font:700 13px 'Barlow Condensed',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => onPick(e.latlng.lat, e.latlng.lng),
    });
    return null;
}

function Recenter({ point }: { point: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (point) map.setView(point, Math.max(map.getZoom(), 15));
    }, [map, point]);
    return null;
}

export default function DepotMap({
    point,
    onPick,
    pinLabel = "⌂",
}: {
    point: [number, number] | null;
    onPick: (lat: number, lng: number) => void;
    pinLabel?: string;
}) {
    return (
        <MapContainer center={point ?? CENTER} zoom={point ? 15 : 12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={onPick} />
            <Recenter point={point} />
            {point && (
                <Marker
                    position={point}
                    icon={pinIcon(pinLabel)}
                    draggable
                    eventHandlers={{
                        dragend: (e) => {
                            const ll = e.target.getLatLng();
                            onPick(ll.lat, ll.lng);
                        },
                    }}
                />
            )}
        </MapContainer>
    );
}
