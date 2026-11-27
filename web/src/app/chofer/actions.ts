"use server";

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { destinations, workdays } from '@/db/schema';
import { pushToAdmins } from '@/lib/push';
import type { Workday } from '@/db/schema';
import { supabaseAdmin } from '@/lib/supabase';
import { requireDriver } from '@/lib/auth';
import { destinationsOf, maybeCloseWorkday, optimizeWorkday } from '@/lib/queries';
import { POD_MIME_TYPES, driverStopError, formId, podFileError } from '@/lib/guards';
import { DestinationStatus, WorkdayStatus, failureReasons } from '@/lib/domain';

// redirect() nunca va dentro de try/catch (lanza una excepción interna de Next):
// cada acción arma la URL de destino y redirige al final.

/** Error con un mensaje apto para mostrarse al chofer. */
class DriverActionError extends Error {}

const toRoute = (key: 'ok' | 'error', message: string) => `/chofer?${key}=${encodeURIComponent(message)}`;

/**
 * Carga la parada con su jornada y comprueba que el chofer pueda actuar sobre
 * ella: su vehículo, jornada en curso, parada pendiente y en el orden de la ruta.
 * Port de DestinationPolicy::complete. Redirige con el motivo si no puede.
 */
async function authorizeStop(formData: FormData): Promise<{ destinationId: number; workday: Workday; reference: string }> {
    const { vehicle } = await requireDriver();
    const destinationId = formId(formData, 'id');

    const [destination] = destinationId
        ? await db.select().from(destinations).where(eq(destinations.id, destinationId))
        : [];
    const [workday] = destination?.workdayId
        ? await db.select().from(workdays).where(eq(workdays.id, destination.workdayId))
        : [];
    const stops = workday ? await destinationsOf(workday.id) : [];

    const denied = driverStopError(vehicle?.id ?? null, workday ?? null, stops, destinationId ?? 0);
    if (denied || !destinationId || !workday) redirect(toRoute('error', denied ?? 'Parada no encontrada.'));

    return { destinationId, workday, reference: destination?.reference ?? '' };
}

async function uploadPod(file: File, destinationId: number, kind: 'photo' | 'signature'): Promise<string> {
    const invalid = podFileError(file);
    if (invalid) throw new DriverActionError(kind === 'signature' ? 'La firma no es válida.' : invalid);

    const path = `${destinationId}/${kind}-${Date.now()}.${POD_MIME_TYPES[file.type]}`;
    const { error } = await supabaseAdmin().storage.from('pod').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new DriverActionError(`No se pudo subir el archivo: ${error.message}`);
    return path;
}

const uploadedFile = (formData: FormData, key: string): File | null => {
    const value = formData.get(key);
    return value instanceof File && value.size > 0 ? value : null;
};

/** Tras cerrar una parada: cierra la jornada si fue la última, si no recalcula desde aquí. */
async function afterStopClosed(workday: Workday, done: string): Promise<string> {
    await maybeCloseWorkday(workday);
    const [fresh] = await db.select().from(workdays).where(eq(workdays.id, workday.id));

    if (fresh && fresh.status !== WorkdayStatus.Completed) {
        try {
            await optimizeWorkday(fresh);
        } catch (error) {
            console.error('[afterStopClosed/optimize]', error);
            return toRoute('ok', `${done}. No se pudo recalcular la ruta; se mantiene el orden actual.`);
        }
    }

    return toRoute('ok', done);
}

export async function completeDestination(formData: FormData) {
    const { destinationId, workday, reference } = await authorizeStop(formData);

    const recipient = String(formData.get('recipient_name') ?? '').trim().slice(0, 120) || null;
    const note = String(formData.get('pod_note') ?? '').trim().slice(0, 500) || null;
    const latitude = Number(formData.get('latitude'));
    const longitude = Number(formData.get('longitude'));
    const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    const photo = uploadedFile(formData, 'photo');
    const signature = uploadedFile(formData, 'signature');

    let target: string;
    try {
        const patch: Partial<typeof destinations.$inferInsert> = {
            status: DestinationStatus.Completed,
            completedAt: new Date(),
            recipientName: recipient,
            podNote: note,
            deliveredLatitude: hasPosition ? latitude : null,
            deliveredLongitude: hasPosition ? longitude : null,
            updatedAt: new Date(),
        };
        if (photo) patch.podPhotoPath = await uploadPod(photo, destinationId, 'photo');
        if (signature) patch.podSignaturePath = await uploadPod(signature, destinationId, 'signature');

        const updated = await db.update(destinations).set(patch)
            .where(and(eq(destinations.id, destinationId), eq(destinations.status, DestinationStatus.Pending)))
            .returning({ id: destinations.id });
        if (!updated.length) throw new DriverActionError('Este destino ya no está pendiente.');

        try {
            await pushToAdmins(workday.companyId, {
                title: 'Entrega completada',
                body: reference + (recipient ? ` · recibió ${recipient}` : ''),
                url: '/admin',
                tag: `ruo-entrega-${destinationId}`,
            });
        } catch (error) {
            console.error('[completeDestination/push]', error);
        }

        target = await afterStopClosed(workday, 'Entrega registrada');
    } catch (error) {
        console.error('[completeDestination]', error);
        target = toRoute('error', error instanceof DriverActionError ? error.message : 'No se pudo completar la entrega.');
    }

    revalidatePath('/chofer');
    redirect(target);
}

export async function failDestination(formData: FormData) {
    const { destinationId, workday, reference } = await authorizeStop(formData);

    const reasonKey = String(formData.get('failure_reason') ?? '');
    if (!(reasonKey in failureReasons)) redirect(toRoute('error', 'Selecciona un motivo de falla.'));

    let target: string;
    try {
        const updated = await db.update(destinations).set({
            status: DestinationStatus.Failed,
            failureReason: failureReasons[reasonKey],
            failedAt: new Date(),
            updatedAt: new Date(),
        }).where(and(eq(destinations.id, destinationId), eq(destinations.status, DestinationStatus.Pending)))
            .returning({ id: destinations.id });
        if (!updated.length) throw new DriverActionError('Este destino ya no está pendiente.');

        try {
            await pushToAdmins(workday.companyId, {
                title: 'Entrega fallida',
                body: `${reference} · ${failureReasons[reasonKey]}`,
                url: '/admin/pedidos',
                tag: `ruo-falla-${destinationId}`,
            });
        } catch (error) {
            console.error('[failDestination/push]', error);
        }

        target = await afterStopClosed(workday, 'Parada marcada como fallida');
    } catch (error) {
        console.error('[failDestination]', error);
        target = toRoute('error', error instanceof DriverActionError ? error.message : 'No se pudo registrar la falla.');
    }

    revalidatePath('/chofer');
    redirect(target);
}

/** Guarda la posición GPS del chofer, solo en la jornada en curso de su propio vehículo. */
export async function reportPosition(formData: FormData): Promise<{ ok: boolean }> {
    const { vehicle } = await requireDriver();
    const workdayId = formId(formData, 'workday_id');
    const latitude = Number(formData.get('latitude'));
    const longitude = Number(formData.get('longitude'));

    const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    if (!vehicle || !workdayId || !valid) return { ok: false };

    const updated = await db.update(workdays).set({
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastPositionAt: new Date(),
    }).where(and(
        eq(workdays.id, workdayId),
        eq(workdays.vehicleId, vehicle.id),
        eq(workdays.status, WorkdayStatus.InProgress),
    )).returning({ id: workdays.id });

    return { ok: updated.length > 0 };
}
