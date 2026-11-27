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
    /** Capacidad máxima en unidades de carga; null = sin límite. */
    capacityUnits?: number | null;
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

/**
 * Reparto con capacidad: mueve pedidos fuera de los vehículos excedidos y los
 * reubica en el vehículo con espacio más cercano. Lo que no cabe en ninguna
 * parte se queda en el pool (leftover) — el admin lo ve y decide.
 * Heurística greedy: k-means no entiende capacidades, así que este post-paso
 * sacrifica un poco de geografía por respetar el límite duro de carga.
 */
export function rebalanceCapacities<T extends Coordinates>(
    groups: Map<number, T[]>,
    vehicles: FleetVehicle[],
    demandOf: (item: T) => number,
): { groups: Map<number, T[]>; leftover: T[] } {
    const loadOf = (items: T[]) => items.reduce((sum, item) => sum + demandOf(item), 0);
    const result = new Map<number, T[]>();
    const overflow: T[] = [];

    // 1. Sacar el exceso: primero los pedidos más lejanos al depósito del vehículo.
    for (const [vehicleId, items] of groups) {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        const capacity = vehicle?.capacityUnits ?? null;
        if (capacity == null || loadOf(items) <= capacity) {
            result.set(vehicleId, items);
            continue;
        }
        const depot = vehicle?.depot;
        const byDistance = [...items].sort((a, b) =>
            depot ? haversine([b.latitude, b.longitude], [depot.latitude, depot.longitude]) - haversine([a.latitude, a.longitude], [depot.latitude, depot.longitude]) : 0);
        const kept: T[] = [];
        let load = 0;
        // Se conservan los más cercanos que quepan; el resto desborda.
        for (const item of [...byDistance].reverse()) {
            if (load + demandOf(item) <= capacity) {
                kept.push(item);
                load += demandOf(item);
            } else {
                overflow.push(item);
            }
        }
        result.set(vehicleId, kept);
    }

    // 2. Reubicar el overflow en el vehículo con espacio más cercano al pedido.
    const leftover: T[] = [];
    for (const item of overflow) {
        const demand = demandOf(item);
        let bestVehicle: number | null = null;
        let bestDistance = Number.MAX_VALUE;
        for (const vehicle of vehicles) {
            const capacity = vehicle.capacityUnits ?? null;
            const current = result.get(vehicle.id) ?? [];
            if (capacity != null && loadOf(current) + demand > capacity) continue;
            const distance = vehicle.depot
                ? haversine([item.latitude, item.longitude], [vehicle.depot.latitude, vehicle.depot.longitude])
                : Number.MAX_VALUE / 2;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestVehicle = vehicle.id;
            }
        }
        if (bestVehicle === null) {
            leftover.push(item);
        } else {
            result.set(bestVehicle, [...(result.get(bestVehicle) ?? []), item]);
        }
    }

    return { groups: result, leftover };
}
