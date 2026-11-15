import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { destinations, vehicles, workdays } from '@/db/schema';
import { planRoute } from '@/lib/services/osrm';
import { splitPool } from '@/lib/services/fleet';
import { DestinationStatus, WorkdayStatus, todayIso, type Coordinates } from '@/lib/domain';
import type { Destination, Vehicle, Workday } from '@/db/schema';

/** Workday del vehículo para una fecha; la crea si no existe. */
export async function workdayFor(vehicleId: number, date: string): Promise<Workday> {
    const [existing] = await db.select().from(workdays)
        .where(and(eq(workdays.vehicleId, vehicleId), eq(workdays.date, date)));
    if (existing) return existing;

    const [created] = await db.insert(workdays).values({ vehicleId, date }).returning();
    return created;
}

export async function destinationsOf(workdayId: number): Promise<Destination[]> {
    return db.select().from(destinations)
        .where(eq(destinations.workdayId, workdayId))
        .orderBy(asc(destinations.position), asc(destinations.id));
}

/** Pedidos del pool (sin asignar) para una fecha. */
export async function poolFor(date: string): Promise<Destination[]> {
    return db.select().from(destinations)
        .where(and(isNull(destinations.workdayId), eq(destinations.serviceDate, date), eq(destinations.status, DestinationStatus.Pending)));
}

/** Fallidos del día (para reagendar). */
export async function failedFor(date: string): Promise<Destination[]> {
    return db.select().from(destinations)
        .where(and(eq(destinations.serviceDate, date), eq(destinations.status, DestinationStatus.Failed)));
}

/** Punto de anclaje de la ruta: última entrega completada o depósito del vehículo. */
function anchorFor(workday: Workday, vehicle: Vehicle | null, ordered: Destination[]): Coordinates | null {
    const lastCompleted = ordered.filter((d) => d.status === DestinationStatus.Completed).sort((a, b) => (b.position ?? 0) - (a.position ?? 0))[0];
    if (lastCompleted) return { latitude: lastCompleted.latitude, longitude: lastCompleted.longitude };
    if (vehicle?.depotLatitude != null && vehicle.depotLongitude != null) {
        return { latitude: vehicle.depotLatitude, longitude: vehicle.depotLongitude };
    }
    return null;
}

/** (Re)optimiza las paradas pendientes de un workday con OSRM. Port de RouteOptimizer::optimize. */
export async function optimizeWorkday(workday: Workday): Promise<void> {
    const all = await destinationsOf(workday.id);
    const pending = all.filter((d) => d.status === DestinationStatus.Pending);
    const completed = all.filter((d) => d.status === DestinationStatus.Completed);

    const [vehicle] = workday.vehicleId
        ? await db.select().from(vehicles).where(eq(vehicles.id, workday.vehicleId))
        : [null];

    const anchor = anchorFor(workday, vehicle ?? null, all);
    const plan = pending.length ? await planRoute(anchor, pending) : [];

    let position = completed.length;
    for (const stop of plan) {
        await db.update(destinations).set({
            position: ++position,
            legDistanceMeters: stop.distance,
            legDurationSeconds: stop.duration,
            legGeometry: stop.geometry,
            legSteps: stop.steps,
        }).where(eq(destinations.id, stop.item.id));
    }

    await db.update(workdays).set({
        status: workday.status === WorkdayStatus.Draft ? WorkdayStatus.InProgress : workday.status,
        routeVersion: workday.routeVersion + 1,
        routeUpdatedAt: new Date(),
    }).where(eq(workdays.id, workday.id));
}

/** Reparte el pool de una fecha entre vehículos y optimiza cada ruta. Port de FleetOptimizer::distribute. */
export async function distributeFleet(date: string): Promise<{ assigned: number; routes: number }> {
    const pool = await poolFor(date);
    if (pool.length === 0) throw new Error('No hay pedidos pendientes de repartir en esa fecha.');

    const fleet = await db.select().from(vehicles);
    if (fleet.length === 0) throw new Error('No hay vehículos disponibles para repartir.');

    const groups = splitPool(pool, fleet.map((v) => ({
        id: v.id,
        depot: v.depotLatitude != null && v.depotLongitude != null
            ? { latitude: v.depotLatitude, longitude: v.depotLongitude }
            : null,
    })));

    let assigned = 0;
    let routes = 0;
    const byId = new Map(fleet.map((v) => [v.id, v]));

    for (const [vehicleId, items] of groups) {
        if (items.length === 0) continue;
        const vehicle = byId.get(vehicleId)!;
        const workday = await workdayFor(vehicle.id, date);

        if (workday.status === WorkdayStatus.Completed) {
            await db.update(workdays).set({
                status: WorkdayStatus.InProgress,
                completedAt: null,
                totalKm: null,
                estimatedFuelLiters: null,
            }).where(eq(workdays.id, workday.id));
        }

        for (const dest of items) {
            await db.update(destinations).set({ workdayId: workday.id }).where(eq(destinations.id, dest.id));
        }
        assigned += items.length;

        await optimizeWorkday({ ...workday, status: WorkdayStatus.InProgress });
        routes++;
    }

    return { assigned, routes };
}

/** Cierra la jornada si todas las paradas terminaron; calcula km y combustible. */
export async function maybeCloseWorkday(workday: Workday): Promise<void> {
    const all = await destinationsOf(workday.id);
    if (all.some((d) => d.status === DestinationStatus.Pending)) return;

    const totalMeters = all.reduce((sum, d) => sum + (d.legDistanceMeters ?? 0), 0);
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, workday.vehicleId));
    const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
    const fuel = vehicle ? Math.round(totalKm * Number(vehicle.fuelLitersPerKm) * 100) / 100 : null;

    await db.update(workdays).set({
        status: WorkdayStatus.Completed,
        completedAt: new Date(),
        totalKm: String(totalKm),
        estimatedFuelLiters: fuel != null ? String(fuel) : null,
    }).where(eq(workdays.id, workday.id));
}

/** ETA estimado de un destino: ahora + suma de duraciones de tramos pendientes hasta él. */
export function etaFor(ordered: Destination[], target: Destination): number | null {
    if (target.status !== DestinationStatus.Pending) return null;
    const pos = target.position ?? ordered.length;
    const seconds = ordered
        .filter((d) => d.status === DestinationStatus.Pending && (d.position ?? 0) <= pos)
        .reduce((sum, d) => sum + (d.legDurationSeconds ?? 0), 0);
    return Date.now() + seconds * 1000;
}

export async function destinationByToken(token: string) {
    const [dest] = await db.select().from(destinations).where(eq(destinations.publicToken, token));
    return dest ?? null;
}

export const trackingUrl = (token: string, base: string) => `${base}/seguimiento/${token}`;

export { todayIso };
