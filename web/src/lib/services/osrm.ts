import type { Coordinates, OsrmLegStep } from '@/lib/domain';
import { instruction } from './directions';

export class RoutingServiceError extends Error {}

interface OsrmWaypoint {
    waypoint_index: number;
}

interface OsrmLeg {
    distance?: number;
    duration?: number;
    steps?: {
        distance?: number;
        duration?: number;
        name?: string;
        maneuver?: { type?: string; modifier?: string; exit?: number };
        geometry?: { coordinates?: [number, number][] };
    }[];
}

interface TripResponse {
    code: string;
    waypoints: OsrmWaypoint[];
    trips: { legs: OsrmLeg[] }[];
}

export interface PlannedStop<T> {
    item: T;
    distance: number;
    duration: number;
    geometry: [number, number][] | null;
    steps: OsrmLegStep[];
}

const buildStop = <T>(item: T, leg: OsrmLeg | null): PlannedStop<T> => {
    if (leg === null) {
        return { item, distance: 0, duration: 0, geometry: null, steps: [] };
    }

    const geometry: [number, number][] = [];
    const steps: OsrmLegStep[] = [];

    for (const step of leg.steps ?? []) {
        for (const [longitude, latitude] of step.geometry?.coordinates ?? []) {
            const point: [number, number] = [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))];
            const last = geometry[geometry.length - 1];
            if (!last || last[0] !== point[0] || last[1] !== point[1]) {
                geometry.push(point);
            }
        }

        steps.push({
            text: instruction(step),
            distanceMeters: Math.round(step.distance ?? 0),
            durationSeconds: Math.round(step.duration ?? 0),
        });
    }

    return {
        item,
        distance: Math.round(leg.distance ?? 0),
        duration: Math.round(leg.duration ?? 0),
        geometry: geometry.length ? geometry : null,
        steps,
    };
};

const requestTrip = async (points: Coordinates[], startsAtAnchor: boolean): Promise<TripResponse> => {
    const coordinates = points.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(';');
    const profile = process.env.OSRM_PROFILE ?? 'driving';
    const base = (process.env.OSRM_URL ?? 'https://router.project-osrm.org').replace(/\/$/, '');
    const params = new URLSearchParams({
        roundtrip: startsAtAnchor ? 'false' : 'true',
        source: startsAtAnchor ? 'first' : 'any',
        destination: 'any',
        steps: 'true',
        geometries: 'geojson',
        overview: 'false',
    });

    let response: Response;
    try {
        response = await fetch(`${base}/trip/v1/${profile}/${coordinates}?${params}`, {
            signal: AbortSignal.timeout(Number(process.env.OSRM_TIMEOUT ?? 15) * 1000),
            cache: 'no-store',
        });
    } catch {
        throw new RoutingServiceError('No se pudo conectar con el servicio de rutas. Revisa tu conexión a internet e intenta de nuevo.');
    }

    const body = (await response.json().catch(() => null)) as TripResponse | null;

    if (!response.ok || body?.code !== 'Ok' || !body.trips?.[0]?.legs?.length) {
        throw new RoutingServiceError('No se pudo calcular la ruta óptima. Verifica que los destinos estén bien ubicados en el mapa e intenta de nuevo.');
    }

    return body;
};

/**
 * Ordena paradas pendientes con el servicio "trip" de OSRM (TSP).
 * Con `anchor` la ruta sale fija de ese punto (depósito o última entrega);
 * sin ancla se resuelve un roundtrip y se corta el tramo más largo.
 * Función pura: la persistencia queda a cargo del route handler.
 */
export async function planRoute<T extends Coordinates>(
    anchor: Coordinates | null,
    pending: T[],
): Promise<PlannedStop<T>[]> {
    if (pending.length === 0) return [];

    const points: { coords: Coordinates; item: T | null }[] = anchor
        ? [{ coords: anchor, item: null }]
        : [];
    pending.forEach((item) => points.push({ coords: item, item }));

    if (points.length === 1) {
        return [buildStop(pending[0], null)];
    }

    const trip = await requestTrip(points.map((p) => p.coords), anchor !== null);

    const order = trip.waypoints
        .map((waypoint, inputIndex) => ({ input: inputIndex, trip: waypoint.waypoint_index }))
        .sort((a, b) => a.trip - b.trip)
        .map((w) => w.input);

    const legs = trip.trips[0].legs;

    if (anchor !== null) {
        return order
            .slice(1)
            .map((inputIndex, tripPosition) => buildStop(points[inputIndex].item as T, legs[tripPosition]));
    }

    // Roundtrip abierto: cortar el tramo más largo.
    const count = order.length;
    const longestLeg = legs.reduce((best, leg, i) => ((leg.distance ?? 0) > (legs[best].distance ?? 0) ? i : best), 0);
    const start = (longestLeg + 1) % count;
    const stops: PlannedStop<T>[] = [buildStop(points[order[start]].item as T, null)];

    for (let offset = 1; offset < count; offset++) {
        const tripPosition = (start + offset) % count;
        const previousLeg = (tripPosition - 1 + count) % count;
        stops.push(buildStop(points[order[tripPosition]].item as T, legs[previousLeg]));
    }

    return stops;
}
