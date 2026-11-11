import type { Coordinates } from '@/lib/domain';

/**
 * Reparto de flota: divide un pool de pedidos entre vehículos con k-means
 * geográfico (semillas deterministas por longitud) y asigna cada clúster al
 * vehículo cuyo depósito está más cerca del centroide.
 * Port de App\Services\FleetOptimizer — funciones puras, testeables.
 */

/** Distancia haversine entre dos puntos [lat, lng], en metros. */
export function haversine(a: [number, number], b: [number, number]): number {
    const earth = 6371000;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const lat = rad(b[0] - a[0]);
    const lng = rad(b[1] - a[1]);

    const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(lng / 2) ** 2;

    return 2 * earth * Math.asin(Math.sqrt(h));
}

export interface FleetVehicle {
    id: number;
    depot: Coordinates | null;
}

interface Cluster<T> {
    centroid: [number, number];
    items: T[];
}

const nearestCentroid = (centroids: [number, number][], point: [number, number]): number => {
    let best = 0;
    let bestDistance = Number.MAX_VALUE;

    centroids.forEach((centroid, index) => {
        const distance = haversine(point, centroid);
        if (distance < bestDistance) {
            best = index;
            bestDistance = distance;
        }
    });

    return best;
};

/** Particiona el pool en k clústeres geográficos (algoritmo de Lloyd, 15 iteraciones máx). */
function clusters<T extends Coordinates>(pool: T[], k: number): Cluster<T>[] {
    const sorted = [...pool].sort((a, b) => a.longitude - b.longitude);
    const last = sorted.length - 1;

    let centroids: [number, number][] = Array.from({ length: k }, (_, i) => {
        const seed = sorted[Math.round((i * last) / Math.max(k - 1, 1))];
        return [seed.latitude, seed.longitude];
    });

    let membership = new Array<number>(sorted.length).fill(0);

    for (let iteration = 0; iteration < 15; iteration++) {
        membership = sorted.map((d) => nearestCentroid(centroids, [d.latitude, d.longitude]));

        const next = centroids.map((centroid, i) => {
            const members = sorted.filter((_, index) => membership[index] === i);
            if (members.length === 0) return centroid;
            return [
                members.reduce((sum, m) => sum + m.latitude, 0) / members.length,
                members.reduce((sum, m) => sum + m.longitude, 0) / members.length,
            ] as [number, number];
        });

        if (next.every((c, i) => c[0] === centroids[i][0] && c[1] === centroids[i][1])) break;
        centroids = next;
    }

    const result: Cluster<T>[] = centroids.map((centroid, i) => ({
        centroid,
        items: sorted.filter((_, index) => membership[index] === i),
    }));

    // Clústeres vacíos roban el miembro más lejano del clúster más grande.
    result.forEach((cluster) => {
        if (cluster.items.length > 0) return;
        const biggest = result.reduce((b, c, i) => (c.items.length > result[b].items.length ? i : b), 0);
        const stolen = result[biggest].items.pop();
        if (stolen) {
            cluster.items.push(stolen);
            cluster.centroid = [stolen.latitude, stolen.longitude];
        }
    });

    return result;
}

/**
 * Divide el pool en un grupo por vehículo.
 * Retorna Map<vehicleId, items>.
 */
export function splitPool<T extends Coordinates>(pool: T[], vehicles: FleetVehicle[]): Map<number, T[]> {
    if (vehicles.length === 1) {
        return new Map([[vehicles[0].id, pool]]);
    }

    const grouped = clusters(pool, vehicles.length);
    const groups = new Map<number, T[]>();
    const usedClusters = new Set<number>();
    const usedVehicles = new Set<number>();

    // Greedy: emparejar clúster↔depósito por distancia ascendente.
    const pairs = grouped.flatMap((cluster, index) =>
        vehicles
            .filter((v) => v.depot !== null)
            .map((vehicle) => ({
                cluster: index,
                vehicle,
                distance: haversine(cluster.centroid, [vehicle.depot!.latitude, vehicle.depot!.longitude]),
            })),
    );

    pairs
        .sort((a, b) => a.distance - b.distance)
        .forEach(({ cluster, vehicle }) => {
            if (usedClusters.has(cluster) || usedVehicles.has(vehicle.id)) return;
            usedClusters.add(cluster);
            usedVehicles.add(vehicle.id);
            groups.set(vehicle.id, grouped[cluster].items);
        });

    const remainingClusters = grouped.map((_, i) => i).filter((i) => !usedClusters.has(i));
    vehicles
        .filter((v) => !usedVehicles.has(v.id))
        .forEach((vehicle, index) => {
            const clusterIndex = remainingClusters[index];
            if (clusterIndex !== undefined) {
                groups.set(vehicle.id, grouped[clusterIndex].items);
            }
        });

    return groups;
}
