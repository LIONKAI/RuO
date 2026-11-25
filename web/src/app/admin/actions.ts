"use server";

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { destinations, profiles, vehicles, workdays } from '@/db/schema';
import { geocode } from '@/lib/services/geocoder';
import { RoutingServiceError } from '@/lib/services/osrm';
import { distributeFleet, optimizeWorkday, todayIso } from '@/lib/queries';
import { requireAdmin } from '@/lib/auth';
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
    await requireAdmin();
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
            await db.insert(destinations).values({ address, reference, phone, ...coords, serviceDate: date });
            revalidatePath('/admin/pedidos');
        }
    } catch (error) {
        console.error('[createDestination]', error);
        target = withMessage(back, 'error', messageOf(error, 'No se pudo guardar el pedido.'));
    }

    redirect(target);
}

/** Elimina un pedido que sigue en el pool (los ya asignados a una ruta no se tocan). */
export async function deleteDestination(formData: FormData) {
    await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;
    const id = formId(formData, 'id');
    if (!id) redirect(back);

    const removed = await db.delete(destinations)
        .where(and(eq(destinations.id, id), isNull(destinations.workdayId)))
        .returning({ id: destinations.id });

    revalidatePath('/admin/pedidos');
    redirect(removed.length ? back : withMessage(back, 'error', 'Ese pedido ya fue asignado a una ruta.'));
}

/** Devuelve un fallido al pool para otra fecha. */
export async function requeueDestination(formData: FormData) {
    await requireAdmin();
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
    }).where(and(eq(destinations.id, id), eq(destinations.status, DestinationStatus.Failed)))
        .returning({ id: destinations.id });

    revalidatePath('/admin/pedidos');
    redirect(requeued.length ? back : withMessage(back, 'error', 'Solo los destinos fallidos pueden volver a la cola.'));
}

export async function distribute(formData: FormData) {
    await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin/pedidos?fecha=${date}`;

    let target: string;
    try {
        const result = await distributeFleet(date);
        revalidatePath('/admin');
        revalidatePath('/admin/pedidos');
        target = withMessage(back, 'ok', `${result.assigned} pedidos repartidos en ${result.routes} rutas`);
    } catch (error) {
        console.error('[distribute]', error);
        target = withMessage(back, 'error', messageOf(error, 'Error al repartir los pedidos.'));
    }

    redirect(target);
}

export async function optimizeRoute(formData: FormData) {
    await requireAdmin();
    const date = dateFrom(formData);
    const back = `/admin?fecha=${date}`;
    const workdayId = formId(formData, 'workday_id');

    const [workday] = workdayId ? await db.select().from(workdays).where(eq(workdays.id, workdayId)) : [];
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

/** Busca un chofer por correo directamente en auth.users (sin paginar la Admin API). */
async function driverIdByEmail(email: string): Promise<{ id: string; role: string } | null> {
    const rows = await db.execute<{ id: string; role: string }>(sql`
        select u.id, p.role
        from auth.users u
        join public.profiles p on p.id = u.id
        where lower(u.email) = lower(${email})
        limit 1
    `);
    return rows[0] ?? null;
}

export async function createVehicle(formData: FormData) {
    await requireAdmin();
    const back = '/admin/vehiculos';

    const name = text(formData, 'name', 80);
    const plate = text(formData, 'plate', 20).toUpperCase();
    const fuel = Number(formData.get('fuel_liters_per_km'));
    const driverEmail = text(formData, 'driver_email', 254) || null;
    const depotAddress = text(formData, 'depot_address', 300) || null;

    if (!name || !plate) redirect(withMessage(back, 'error', 'Nombre y placa son obligatorios.'));

    let target = back;
    try {
        let depot: { latitude: number; longitude: number } | null = manualCoordinates(formData);
        if (!depot && depotAddress) {
            depot = await geocode(depotAddress);
            if (!depot) throw new RoutingServiceError(`No se encontró el depósito «${depotAddress}». Pega las coordenadas manualmente (Google Maps → clic derecho → copiar).`);
        }

        let driverId: string | null = null;
        const driverIdRaw = text(formData, 'driver_id', 40) || null;
        if (driverIdRaw) {
            const [driver] = await db.select().from(profiles).where(eq(profiles.id, driverIdRaw)).limit(1);
            if (!driver) throw new RoutingServiceError('El chofer seleccionado no existe.');
            if (driver.role !== UserRole.Driver) throw new RoutingServiceError('Ese usuario no tiene rol de chofer.');
            driverId = driver.id;
        } else if (driverEmail) {
            // Compatibilidad con el campo de correo libre (formularios viejos).
            const driver = await driverIdByEmail(driverEmail);
            if (!driver) throw new RoutingServiceError(`No existe un usuario con correo «${driverEmail}».`);
            if (driver.role !== UserRole.Driver) throw new RoutingServiceError(`«${driverEmail}» no tiene rol de chofer.`);
            driverId = driver.id;
        }

        await db.insert(vehicles).values({
            name,
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
    await requireAdmin();
    const back = '/admin/vehiculos';
    const id = formId(formData, 'id');
    if (!id) redirect(back);

    const [running] = await db.select({ id: workdays.id }).from(workdays)
        .where(and(eq(workdays.vehicleId, id), eq(workdays.status, WorkdayStatus.InProgress)))
        .limit(1);
    if (running) redirect(withMessage(back, 'error', 'Ese vehículo tiene una ruta en curso; termínala antes de eliminarlo.'));

    await db.delete(vehicles).where(eq(vehicles.id, id));
    revalidatePath(back);
    redirect(back);
}

