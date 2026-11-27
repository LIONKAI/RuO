import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { destinations, vehicles, workdays } from '@/db/schema';
import { planRoute, RoutingServiceError, type PlannedStop } from '@/lib/services/osrm';
import { splitPool } from '@/lib/services/fleet';
import { withDbRetry } from '@/lib/retry';
import { DestinationStatus, WorkdayStatus, todayIso, type Coordinates } from '@/lib/domain';
import type { Destination, Vehicle, Workday } from '@/db/schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Workday del vehículo para una fecha; la crea si no existe (seguro ante requests concurrentes). */
export async function workdayFor(vehicleId: number, date: string, companyId: string): Promise<Workday> {
    const find = () => withDbRetry(() =>
        db.select().from(workdays).where(and(eq(workdays.vehicleId, vehicleId), eq(workdays.date, date))));

    const [existing] = await find();
    if (existing) return existing;

    const [created] = await db.insert(workdays).values({ vehicleId, date, companyId }).onConflictDoNothing().returning();
    if (created) return created;

    const [raced] = await find();
    return raced;
}

export async function destinationsOf(workdayId: number): Promise<Destination[]> {
    return withDbRetry(() => db.select().from(destinations)
        .where(eq(destinations.workdayId, workdayId))
        .orderBy(asc(destinations.position), asc(destinations.id)));
}

/** Pedidos del pool (sin asignar) para una fecha. */
export async function poolFor(date: string, companyId: string): Promise<Destination[]> {
    return withDbRetry(() => db.select().from(destinations)
        .where(and(isNull(destinations.workdayId), eq(destinations.serviceDate, date), eq(destinations.status, DestinationStatus.Pending), eq(destinations.companyId, companyId))));
}

/** Fallidos del día (para reagendar). */
export async function failedFor(date: string, companyId: string): Promise<Destination[]> {
    return withDbRetry(() => db.select().from(destinations)
        .where(and(eq(destinations.serviceDate, date), eq(destinations.status, DestinationStatus.Failed), eq(destinations.companyId, companyId))));
}

interface RoutePlan {
    /** Última posición ya ocupada por paradas visitadas (entregadas o fallidas). */
    startAfter: number;
    stops: PlannedStop<Destination>[];
}

/**
 * Calcula (sin escribir nada) el orden óptimo de las paradas pendientes de un
 * workday más `incoming`. La ruta parte de la última parada visitada o, si la
 * jornada no empezó, del depósito del vehículo.
 */
async function planWorkday(workday: Workday, vehicle: Vehicle | null, incoming: Destination[] = []): Promise<RoutePlan> {
    const current = await destinationsOf(workday.id);
    const visited = current
        .filter((d) => d.status !== DestinationStatus.Pending)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const pending = [...current.filter((d) => d.status === DestinationStatus.Pending), ...incoming];

    const lastVisited = visited[visited.length - 1];
    const anchor: Coordinates | null = lastVisited
        ? { latitude: lastVisited.latitude, longitude: lastVisited.longitude }
        : vehicle?.depotLatitude != null && vehicle.depotLongitude != null
            ? { latitude: vehicle.depotLatitude, longitude: vehicle.depotLongitude }
            : null;

    return {
        startAfter: visited.reduce((max, d) => Math.max(max, d.position ?? 0), 0),
        stops: pending.length ? await planRoute(anchor, pending) : [],
    };
}

/** Persiste un plan: asigna las paradas al workday, numera y guarda cada tramo. */
async function writePlan(tx: Transaction, workday: Workday, plan: RoutePlan, reopen: boolean): Promise<void> {
    let position = plan.startAfter;

    for (const stop of plan.stops) {
        await tx.update(destinations).set({
            workdayId: workday.id,
            position: ++position,
            legDistanceMeters: stop.distance,
            legDurationSeconds: stop.duration,
            legGeometry: stop.geometry,
            legSteps: stop.steps,
            updatedAt: new Date(),
        }).where(eq(destinations.id, stop.item.id));
    }

    const reopening = reopen && workday.status === WorkdayStatus.Completed;

    await tx.update(workdays).set({
        status: workday.status === WorkdayStatus.Draft || reopening ? WorkdayStatus.InProgress : workday.status,
        routeVersion: sql`${workdays.routeVersion} + 1`,
        routeUpdatedAt: new Date(),
        updatedAt: new Date(),
        ...(reopening ? { completedAt: null, totalKm: null, estimatedFuelLiters: null } : {}),
    }).where(eq(workdays.id, workday.id));
}

async function vehicleOf(workday: Workday): Promise<Vehicle | null> {
    const [vehicle] = await withDbRetry(() => db.select().from(vehicles).where(eq(vehicles.id, workday.vehicleId)));
    return vehicle ?? null;
}

/**
 * (Re)optimiza las paradas pendientes de un workday con OSRM. Port de RouteOptimizer::optimize.
 * La llamada a OSRM ocurre fuera de la transacción; si falla no se toca la BD.
 */
export async function optimizeWorkday(workday: Workday): Promise<void> {
    const plan = await planWorkday(workday, await vehicleOf(workday));

    if (plan.startAfter === 0 && plan.stops.length === 0) {
        throw new RoutingServiceError('Carga al menos un destino antes de generar la ruta.');
    }

    await db.transaction((tx) => writePlan(tx, workday, plan, false));
}

/**
 * Reparte el pool de una fecha entre vehículos y optimiza cada ruta. Port de FleetOptimizer::distribute.
 * Primero se calculan todas las rutas; solo si OSRM respondió para todas se
 * escriben juntas en una transacción (todo o nada).
 */
export async function distributeFleet(date: string, companyId: string): Promise<{ assigned: number; routes: number }> {
    const pool = await poolFor(date, companyId);
    if (pool.length === 0) throw new RoutingServiceError('No hay pedidos pendientes de repartir en esa fecha.');

    const fleet = await withDbRetry(() => db.select().from(vehicles).where(eq(vehicles.companyId, companyId)));
    if (fleet.length === 0) throw new RoutingServiceError('No hay vehículos disponibles para repartir.');

    const groups = splitPool(pool, fleet.map((v) => ({
        id: v.id,
        depot: v.depotLatitude != null && v.depotLongitude != null
            ? { latitude: v.depotLatitude, longitude: v.depotLongitude }
            : null,
    })));

    const byId = new Map(fleet.map((v) => [v.id, v]));
    const plans: { workday: Workday; plan: RoutePlan; assigned: number }[] = [];

    for (const [vehicleId, items] of groups) {
        if (items.length === 0) continue;
        const vehicle = byId.get(vehicleId)!;
        const workday = await workdayFor(vehicle.id, date, companyId);
        plans.push({ workday, plan: await planWorkday(workday, vehicle, items), assigned: items.length });
    }

    await db.transaction(async (tx) => {
        for (const { workday, plan } of plans) {
            await writePlan(tx, workday, plan, true);
        }
    });

    return {
        assigned: plans.reduce((sum, p) => sum + p.assigned, 0),
        routes: plans.length,
    };
}

/** Cierra la jornada si todas las paradas terminaron; calcula km y combustible. */
export async function maybeCloseWorkday(workday: Workday): Promise<void> {
    const all = await destinationsOf(workday.id);
    if (all.length === 0 || all.some((d) => d.status === DestinationStatus.Pending)) return;

    const totalMeters = all.reduce((sum, d) => sum + (d.legDistanceMeters ?? 0), 0);
    const vehicle = await vehicleOf(workday);
    const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
    const fuel = vehicle ? Math.round(totalKm * Number(vehicle.fuelLitersPerKm) * 100) / 100 : null;

    await db.update(workdays).set({
        status: WorkdayStatus.Completed,
        completedAt: new Date(),
        totalKm: String(totalKm),
        estimatedFuelLiters: fuel != null ? String(fuel) : null,
        updatedAt: new Date(),
    }).where(eq(workdays.id, workday.id));
}

/** ETA estimado de un destino: ahora + suma de duraciones de tramos pendientes hasta él. */
/** Minutos que el chofer pasa en cada parada (estacionar, entregar, firmar). */
const SERVICE_MINUTES_PER_STOP = 5;

export function etaFor(ordered: Destination[], target: Destination): number | null {
    if (target.status !== DestinationStatus.Pending) return null;
    const pos = target.position ?? ordered.length;
    const ahead = ordered.filter((d) => d.status === DestinationStatus.Pending && (d.position ?? 0) <= pos);
    const driving = ahead.reduce((sum, d) => sum + (d.legDurationSeconds ?? 0), 0);
    // Servicio en las paradas previas; en la propia no cuenta porque la ETA es la llegada.
    const service = Math.max(0, ahead.length - 1) * SERVICE_MINUTES_PER_STOP * 60;
    return Date.now() + (driving + service) * 1000;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Destino por su token público; un token mal formado no llega a la BD (evita un error de cast a uuid). */
export async function destinationByToken(token: string) {
    if (!UUID.test(token)) return null;
    const [dest] = await withDbRetry(() => db.select().from(destinations).where(eq(destinations.publicToken, token)));
    return dest ?? null;
}

export const trackingUrl = (token: string, base: string) => `${base}/seguimiento/${token}`;

export { todayIso };
