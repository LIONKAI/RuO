"use server";

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { workdays } from '@/db/schema';
import { requireDriver } from '@/lib/auth';
import { formId } from '@/lib/guards';
import { WorkdayStatus, failureReasons } from '@/lib/domain';
import {
    DeliveryError,
    authorizeStopData,
    closeStopAndOptimize,
    executeCompletion,
    executeFailure,
    parseCompletionInput,
} from '@/lib/delivery';

// redirect() nunca va dentro de try/catch (lanza una excepción interna de Next):
// cada acción arma la URL de destino y redirige al final.

const toRoute = (key: 'ok' | 'error', message: string) => `/chofer?${key}=${encodeURIComponent(message)}`;

/** Autoriza la parada del chofer; redirige con el motivo si no puede actuar. */
async function authorizeStop(formData: FormData) {
    const { vehicle } = await requireDriver();
    const destinationId = formId(formData, 'id');
    const result = await authorizeStopData(vehicle?.id ?? null, destinationId);
    if ('error' in result) redirect(toRoute('error', result.error));
    return result;
}

export async function completeDestination(formData: FormData) {
    const auth = await authorizeStop(formData);

    let target: string;
    try {
        await executeCompletion(parseCompletionInput(formData, auth));
        try {
            await closeStopAndOptimize(auth.workday);
            target = toRoute('ok', 'Entrega registrada');
        } catch {
            target = toRoute('ok', 'Entrega registrada. No se pudo recalcular la ruta; se mantiene el orden actual.');
        }
    } catch (error) {
        console.error('[completeDestination]', error);
        target = toRoute('error', error instanceof DeliveryError ? error.message : 'No se pudo completar la entrega.');
    }

    revalidatePath('/chofer');
    redirect(target);
}

export async function failDestination(formData: FormData) {
    const auth = await authorizeStop(formData);

    const reasonKey = String(formData.get('failure_reason') ?? '');
    if (!(reasonKey in failureReasons)) redirect(toRoute('error', 'Selecciona un motivo de falla.'));

    let target: string;
    try {
        await executeFailure(auth.destinationId, auth.workday, auth.dest, failureReasons[reasonKey]);
        try {
            await closeStopAndOptimize(auth.workday);
            target = toRoute('ok', 'Parada marcada como fallida');
        } catch {
            target = toRoute('ok', 'Parada marcada como fallida. No se pudo recalcular la ruta.');
        }
    } catch (error) {
        console.error('[failDestination]', error);
        target = toRoute('error', error instanceof DeliveryError ? error.message : 'No se pudo registrar la falla.');
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
