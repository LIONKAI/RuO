"use server";

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { destinations, vehicles } from '@/db/schema';
import { geocode } from '@/lib/services/geocoder';
import { distributeFleet, optimizeWorkday, workdayFor, todayIso } from '@/lib/queries';
import { currentUser } from '@/lib/supabase';
import { DestinationStatus, UserRole } from '@/lib/domain';

async function requireAdmin() {
    const user = await currentUser();
    if (!user || user.role !== UserRole.Admin) redirect('/login');
    return user;
}

const fail = (url: string, msg: string): never => redirect(`${url}?error=${encodeURIComponent(msg)}`);

export async function createDestination(formData: FormData) {
    await requireAdmin();
    const date = String(formData.get('date') || todayIso());
    const back = `/admin/pedidos?fecha=${date}`;

    const address = String(formData.get('address') ?? '').trim();
    const reference = String(formData.get('reference') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim() || null;
    if (!address || !reference) fail(back, 'Dirección y referencia son obligatorias.');

    let latitude = Number(formData.get('latitude'));
    let longitude = Number(formData.get('longitude'));
    if (!latitude || !longitude) {
        const geo = await geocode(address);
        if (!geo) redirect(`${back}&error=${encodeURIComponent(`No se encontró «${address}» en el mapa. Sé más específico o pega coordenadas.`)}`);
        latitude = geo.latitude;
        longitude = geo.longitude;
    }

    await db.insert(destinations).values({
        address, reference, phone, latitude, longitude, serviceDate: date,
    });
    revalidatePath('/admin/pedidos');
    redirect(back);
}

export async function deleteDestination(formData: FormData) {
    await requireAdmin();
    const id = Number(formData.get('id'));
    const date = String(formData.get('date') || todayIso());
    await db.delete(destinations).where(eq(destinations.id, id));
    revalidatePath('/admin/pedidos');
    redirect(`/admin/pedidos?fecha=${date}`);
}

/** Devuelve un fallido al pool para otra fecha. */
export async function requeueDestination(formData: FormData) {
    await requireAdmin();
    const id = Number(formData.get('id'));
    const date = String(formData.get('date') || todayIso());
    const newDate = String(formData.get('service_date') || date);

    await db.update(destinations).set({
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
    }).where(eq(destinations.id, id));

    revalidatePath('/admin/pedidos');
    redirect(`/admin/pedidos?fecha=${date}`);
}

export async function distribute(formData: FormData) {
    await requireAdmin();
    const date = String(formData.get('date') || todayIso());
    try {
        const r = await distributeFleet(date);
        redirect(`/admin/pedidos?fecha=${date}&ok=${encodeURIComponent(`${r.assigned} pedidos repartidos en ${r.routes} rutas`)}`);
    } catch (e) {
        fail(`/admin/pedidos?fecha=${date}`, e instanceof Error ? e.message : 'Error al repartir');
    }
}

export async function optimizeRoute(formData: FormData) {
    await requireAdmin();
    const workdayId = Number(formData.get('workday_id'));
    const date = String(formData.get('date') || todayIso());
    const { workdays } = await import('@/db/schema');
    const [workday] = await db.select().from(workdays).where(eq(workdays.id, workdayId));
    if (!workday) fail('/admin', 'Jornada no encontrada');
    try {
        await optimizeWorkday(workday);
        redirect(`/admin?fecha=${date}&ok=Ruta reoptimizada`);
    } catch (e) {
        fail(`/admin?fecha=${date}`, e instanceof Error ? e.message : 'Error al optimizar');
    }
}

export async function createVehicle(formData: FormData) {
    await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    const plate = String(formData.get('plate') ?? '').trim();
    const fuel = Number(formData.get('fuel_liters_per_km')) || 0.10;
    const driverEmail = String(formData.get('driver_email') ?? '').trim() || null;
    const depotAddress = String(formData.get('depot_address') ?? '').trim() || null;

    if (!name || !plate) fail('/admin/vehiculos', 'Nombre y placa son obligatorios.');

    let depotLatitude: number | null = null;
    let depotLongitude: number | null = null;
    if (depotAddress) {
        const geo = await geocode(depotAddress);
        if (!geo) redirect(`/admin/vehiculos?error=${encodeURIComponent(`No se encontró el depósito «${depotAddress}».`)}`);
        depotLatitude = geo.latitude;
        depotLongitude = geo.longitude;
    }

    let driverId: string | null = null;
    if (driverEmail) {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data: { users } } = await supabaseAdmin().auth.admin.listUsers();
        driverId = users.find((u) => u.email === driverEmail)?.id ?? null;
        if (!driverId) fail('/admin/vehiculos', `No existe un usuario con correo «${driverEmail}».`);
    }

    await db.insert(vehicles).values({ name, plate, fuelLitersPerKm: String(fuel), driverId, depotAddress, depotLatitude, depotLongitude });
    revalidatePath('/admin/vehiculos');
    redirect('/admin/vehiculos');
}

export async function deleteVehicle(formData: FormData) {
    await requireAdmin();
    const id = Number(formData.get('id'));
    await db.delete(vehicles).where(eq(vehicles.id, id));
    revalidatePath('/admin/vehiculos');
    redirect('/admin/vehiculos');
}

export { workdayFor };
