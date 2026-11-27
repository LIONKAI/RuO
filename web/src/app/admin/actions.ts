"use server";

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { companies, destinations, profiles, vehicles, workdays } from '@/db/schema';
import { geocode } from '@/lib/services/geocoder';
import { RoutingServiceError } from '@/lib/services/osrm';
import { distributeFleet, optimizeWorkday, todayIso } from '@/lib/queries';
import { requireAdmin } from '@/lib/auth';
import { pushToProfile } from '@/lib/push';
import { notifyCompany, payloadFor } from '@/lib/notify';
import { formId, isUniqueViolation } from '@/lib/guards';
import { DestinationStatus, UserRole, WorkdayStatus, isIsoDate } from '@/lib/domain';

// Nota: redirect() funciona lanzando una excepción interna de Next, así que
// nunca se llama dentro de un try/catch: el catch la atraparía como si fuera
// un error. Cada acción calcula la URL de destino y redirige al final.

const withMessage = (url: string, key: 'ok' | 'error', message: string) =>
    `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message)}`;

const messageOf = (error: unknown, fallback: string) =>
    error instanceof RoutingServiceError ? error.message : fallback;

/** Fecha del formulario si es válida (YYYY-MM-DD); hoy en Bolivia si no. */
const dateFrom = (formData: FormData, key = 'date'): string => {
    const value = formData.get(key);
    return isIsoDate(value) ? value : todayIso();
};

const text = (formData: FormData, key: string, max = 255): string =>
    String(formData.get(key) ?? '').trim().slice(0, max);

/** Coordenadas pegadas a mano, o null si no vinieron o no son válidas. */
const manualCoordinates = (formData: FormData): { latitude: number; longitude: number } | null => {
    const rawLatitude = String(formData.get('latitude') ?? '').trim();
    const rawLongitude = String(formData.get('longitude') ?? '').trim();
    if (!rawLatitude || !rawLongitude) return null;

    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    return valid ? { latitude, longitude } : null;
};

export async function createDestination(formData: FormData) {
    const { companyId } = await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;

    const address = text(formData, 'address', 300);
    const reference = text(formData, 'reference', 120);
    const phone = text(formData, 'phone', 30) || null;
    if (!address || !reference) redirect(withMessage(back, 'error', 'Dirección y referencia son obligatorias.'));

    let target = back;
    try {
        const coords = manualCoordinates(formData) ?? await geocode(address);
        if (!coords) {
            target = withMessage(back, 'error', `No se encontró «${address}» en el mapa. Sé más específico o pega coordenadas.`);
        } else {
            const amount = Number(formData.get('amount'));
            const amountToCollect = Number.isFinite(amount) && amount > 0 ? String(Math.min(amount, 999999)) : null;
            const demandRaw = Number(formData.get('demand_units'));
            const demandUnits = Number.isFinite(demandRaw) && demandRaw >= 1 ? Math.min(Math.round(demandRaw), 1000) : 1;
            const hhmm = (v: FormDataEntryValue | null) => {
                const str = String(v ?? '').trim();
                return /^([01]\d|2[0-3]):[0-5]\d$/.test(str) ? str : null;
            };
            const windowStart = hhmm(formData.get('window_start'));
            const windowEnd = hhmm(formData.get('window_end'));
            await db.insert(destinations).values({ companyId, address, reference, phone, amountToCollect, demandUnits, windowStart, windowEnd, ...coords, serviceDate: date });
            revalidatePath('/admin/pedidos');
        }
    } catch (error) {
        console.error('[createDestination]', error);
        target = withMessage(back, 'error', messageOf(error, 'No se pudo guardar el pedido.'));
    }

    redirect(target);
}


/** Importación masiva: el cliente geocodifica en el navegador y envía filas listas. */
export async function importDestinations(formData: FormData) {
    const { companyId } = await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;

    let rows: { address: string; reference: string; phone: string | null; latitude: number; longitude: number; amount?: number | null }[] = [];
    try {
        const parsed = JSON.parse(String(formData.get('rows') ?? '[]'));
        if (Array.isArray(parsed)) rows = parsed.slice(0, 200);
    } catch {
        redirect(withMessage(back, 'error', 'El archivo no pudo leerse.'));
    }

    const valid = rows.filter((r) =>
        typeof r.address === 'string' && r.address.trim().length > 2
        && typeof r.reference === 'string' && r.reference.trim().length > 0
        && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
        && Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180);

    if (valid.length === 0) redirect(withMessage(back, 'error', 'Ninguna fila tenía datos válidos.'));

    let target: string;
    try {
        // Inserción por lotes de 50 para no armar queries gigantes.
        for (let i = 0; i < valid.length; i += 50) {
            await db.insert(destinations).values(
                valid.slice(i, i + 50).map((r) => ({
                    companyId,
                    address: r.address.trim().slice(0, 300),
                    reference: r.reference.trim().slice(0, 120),
                    phone: typeof r.phone === 'string' && r.phone.trim() ? r.phone.trim().slice(0, 30) : null,
                    latitude: r.latitude,
                    longitude: r.longitude,
                    amountToCollect: typeof r.amount === 'number' && r.amount > 0 ? String(Math.min(r.amount, 999999)) : null,
                    serviceDate: date,
                })),
            );
        }
        revalidatePath('/admin/pedidos');
        const skipped = rows.length - valid.length;
        const extra = skipped > 0 ? ` (${skipped} filas incompletas o sin coordenadas se omitieron)` : '';
        target = withMessage(back, 'ok', `${valid.length} pedidos importados al pool.${extra}`);
    } catch (error) {
        console.error('[importDestinations]', error);
        target = withMessage(back, 'error', 'Error al guardar la importación.');
    }

    redirect(target);
}

/** Elimina un pedido que sigue en el pool (los ya asignados a una ruta no se tocan). */
export async function deleteDestination(formData: FormData) {
    const { companyId } = await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;
    const id = formId(formData, 'id');
    if (!id) redirect(back);

    const removed = await db.delete(destinations)
        .where(and(eq(destinations.id, id), isNull(destinations.workdayId), eq(destinations.companyId, companyId)))
        .returning({ id: destinations.id });

    revalidatePath('/admin/pedidos');
    redirect(removed.length ? back : withMessage(back, 'error', 'Ese pedido ya fue asignado a una ruta.'));
}

/** Devuelve un fallido al pool para otra fecha. */
export async function requeueDestination(formData: FormData) {
    const { companyId } = await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;
    const id = formId(formData, 'id');
    const newDate = dateFrom(formData, 'service_date');
    if (!id) redirect(back);

    const requeued = await db.update(destinations).set({
        workdayId: null,
        serviceDate: newDate,
        status: DestinationStatus.Pending,
        position: null,
        legDistanceMeters: null,
        legDurationSeconds: null,
        legGeometry: null,
        legSteps: null,
        failureReason: null,
        failedAt: null,
        updatedAt: new Date(),
    }).where(and(eq(destinations.id, id), eq(destinations.status, DestinationStatus.Failed), eq(destinations.companyId, companyId)))
        .returning({ id: destinations.id });

    revalidatePath('/admin/pedidos');
    redirect(requeued.length ? back : withMessage(back, 'error', 'Solo los destinos fallidos pueden volver a la cola.'));
}

export async function distribute(formData: FormData) {
    const { companyId } = await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;

    let target: string;
    try {
        const result = await distributeFleet(date, companyId);

        try {
            const perDriver = await db.select({
                driverId: vehicles.driverId,
                stops: sql<number>`count(${destinations.id})`,
            }).from(workdays)
                .innerJoin(vehicles, eq(vehicles.id, workdays.vehicleId))
                .innerJoin(destinations, and(eq(destinations.workdayId, workdays.id), eq(destinations.status, DestinationStatus.Pending)))
                .where(and(eq(workdays.companyId, companyId), eq(workdays.date, date)))
                .groupBy(vehicles.driverId);
            await Promise.allSettled(
                perDriver.filter((r) => r.driverId).map((r) =>
                    pushToProfile(r.driverId!, {
                        title: 'Ruta del día lista',
                        body: `Tienes ${r.stops} entregas asignadas para hoy.`,
                        url: '/chofer',
                        tag: `ruo-ruta-${date}`,
                    })),
            );
            const asignados = await db.select().from(destinations)
                .where(and(eq(destinations.companyId, companyId), eq(destinations.serviceDate, date), eq(destinations.status, DestinationStatus.Pending)));
            const conTelefono = asignados.filter((d) => d.phone);
            if (conTelefono.length > 0) {
                await notifyCompany(companyId, conTelefono.map((d) => payloadFor('en_camino', '', d)));
            }
        } catch (error) {
            console.error('[distribute/push]', error);
        }

        revalidatePath('/admin');
        revalidatePath('/admin/pedidos');
        const aviso = result.leftover > 0 ? `. ⚠ ${result.leftover} no cupieron en la capacidad de la flota y quedaron en el pool` : '';
        target = withMessage(back, 'ok', `${result.assigned} pedidos repartidos en ${result.routes} rutas${aviso}`);
    } catch (error) {
        console.error('[distribute]', error);
        target = withMessage(back, 'error', messageOf(error, 'Error al repartir los pedidos.'));
    }

    redirect(target);
}

export async function optimizeRoute(formData: FormData) {
    const { companyId } = await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin?fecha=${date}`;
    const workdayId = formId(formData, 'workday_id');

    const [workday] = workdayId ? await db.select().from(workdays).where(and(eq(workdays.id, workdayId), eq(workdays.companyId, companyId))) : [];
    if (!workday) redirect(withMessage(back, 'error', 'Jornada no encontrada.'));

    let target: string;
    try {
        await optimizeWorkday(workday);
        revalidatePath('/admin');
        target = withMessage(back, 'ok', 'Ruta reoptimizada');
    } catch (error) {
        console.error('[optimizeRoute]', error);
        target = withMessage(back, 'error', messageOf(error, 'Error al optimizar la ruta.'));
    }

    redirect(target);
}

export async function createVehicle(formData: FormData) {
    const { companyId } = await requireAdmin();
    const back = '/admin/vehiculos';

    const name = text(formData, 'name', 80);
    const plate = text(formData, 'plate', 20).toUpperCase();
    const fuel = Number(formData.get('fuel_liters_per_km'));
    const depotAddress = text(formData, 'depot_address', 300) || null;

    if (!name || !plate) redirect(withMessage(back, 'error', 'Nombre y placa son obligatorios.'));

    let target = back;
    try {
        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
        const [{ n: vehiculosActuales }] = await db.select({ n: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.companyId, companyId));
        if (company && Number(vehiculosActuales) >= company.maxVehicles) {
            throw new RoutingServiceError(`Tu plan ${company.plan} permite hasta ${company.maxVehicles} vehículos. Escríbenos para ampliarlo.`);
        }

        let depot: { latitude: number; longitude: number } | null = manualCoordinates(formData);
        if (!depot && depotAddress) {
            depot = await geocode(depotAddress);
            if (!depot) throw new RoutingServiceError(`No se encontró el depósito «${depotAddress}». Márcalo tocando el mapa.`);
        }

        const capacityRaw = Number(formData.get('capacity_units'));
        const capacityUnits = Number.isFinite(capacityRaw) && capacityRaw > 0 ? Math.min(Math.round(capacityRaw), 10000) : null;

        let driverId: string | null = null;
        const driverIdRaw = text(formData, 'driver_id', 40) || null;
        if (driverIdRaw) {
            const [driver] = await db.select().from(profiles).where(eq(profiles.id, driverIdRaw)).limit(1);
            if (!driver || driver.companyId !== companyId) throw new RoutingServiceError('El chofer seleccionado no existe.');
            if (driver.role !== UserRole.Driver) throw new RoutingServiceError('Ese usuario no tiene rol de chofer.');
            driverId = driver.id;
        }

        await db.insert(vehicles).values({
            companyId,
            name,
            capacityUnits,
            plate,
            fuelLitersPerKm: String(Number.isFinite(fuel) && fuel > 0 && fuel < 10 ? fuel : 0.1),
            driverId,
            depotAddress,
            depotLatitude: depot?.latitude ?? null,
            depotLongitude: depot?.longitude ?? null,
        });
        revalidatePath(back);
    } catch (error) {
        // El error real queda en los logs de Vercel; al usuario solo le llega
        // un mensaje accionable. Sin esto, cualquier falla inesperada es invisible.
        console.error('[createVehicle]', error);
        const message = isUniqueViolation(error)
            ? 'Ya existe un vehículo con esa placa o ese chofer ya tiene vehículo asignado.'
            : messageOf(error, 'No se pudo crear el vehículo.');
        target = withMessage(back, 'error', message);
    }

    redirect(target);
}

/** Elimina un vehículo. Se bloquea si tiene una ruta en curso (borraría sus entregas en cascada). */
export async function deleteVehicle(formData: FormData) {
    const { companyId } = await requireAdmin();
    const back = '/admin/vehiculos';
    const id = formId(formData, 'id');
    if (!id) redirect(back);

    const [running] = await db.select({ id: workdays.id }).from(workdays)
        .where(and(eq(workdays.vehicleId, id), eq(workdays.status, WorkdayStatus.InProgress), eq(workdays.companyId, companyId)))
        .limit(1);
    if (running) redirect(withMessage(back, 'error', 'Ese vehículo tiene una ruta en curso; termínala antes de eliminarlo.'));

    await db.delete(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId)));
    revalidatePath(back);
    redirect(back);
}

