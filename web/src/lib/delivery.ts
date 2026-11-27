import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { destinations, workdays, type Workday, type Destination } from '@/db/schema';
import { pushToAdmins } from '@/lib/push';
import { notifyCompany, payloadFor } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabase';
import { destinationsOf, maybeCloseWorkday, optimizeWorkday } from '@/lib/queries';
import { POD_MIME_TYPES, driverStopError, podFileError } from '@/lib/guards';
import { DestinationStatus, WorkdayStatus } from '@/lib/domain';

/**
 * Núcleo de registro de entregas/fallas, compartido por la server action del
 * chofer (uso en vivo) y el endpoint de sincronización offline. No redirige:
 * devuelve datos o lanza DeliveryError con mensaje mostrable.
 */

export class DeliveryError extends Error {}

export interface StopAuth {
    destinationId: number;
    workday: Workday;
    dest: Destination;
}

/** Comprueba que el chofer pueda actuar sobre la parada; devuelve null si sí, o el motivo. */
export async function authorizeStopData(vehicleId: number | null, destinationIdInput: number | null): Promise<{ error: string } | StopAuth> {
    const destinationId = destinationIdInput ?? 0;
    const [destination] = destinationId
        ? await db.select().from(destinations).where(eq(destinations.id, destinationId))
        : [];
    const [workday] = destination?.workdayId
        ? await db.select().from(workdays).where(eq(workdays.id, destination.workdayId))
        : [];
    const stops = workday ? await destinationsOf(workday.id) : [];

    const denied = driverStopError(vehicleId, workday ?? null, stops, destinationId);
    if (denied || !destinationId || !workday || !destination) {
        return { error: denied ?? 'Parada no encontrada.' };
    }
    return { destinationId, workday, dest: destination };
}

async function uploadPod(file: File, destinationId: number, kind: 'photo' | 'signature'): Promise<string> {
    const invalid = podFileError(file);
    if (invalid) throw new DeliveryError(kind === 'signature' ? 'La firma no es válida.' : invalid);

    const path = `${destinationId}/${kind}-${Date.now()}.${POD_MIME_TYPES[file.type]}`;
    const { error } = await supabaseAdmin().storage.from('pod').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new DeliveryError(`No se pudo subir el archivo: ${error.message}`);
    return path;
}

/** Tras cerrar una parada: cierra la jornada si fue la última, si no recalcula el resto de la ruta. */
export async function closeStopAndOptimize(workday: Workday): Promise<void> {
    await maybeCloseWorkday(workday);
    const [fresh] = await db.select().from(workdays).where(eq(workdays.id, workday.id));

    if (fresh && fresh.status !== WorkdayStatus.Completed) {
        try {
            await optimizeWorkday(fresh);
        } catch (error) {
            console.error('[closeStopAndOptimize]', error);
        }
    }
}

export interface CompletionInput {
    destinationId: number;
    workday: Workday;
    dest: Destination;
    recipient: string | null;
    note: string | null;
    latitude: number | null;
    longitude: number | null;
    photo: File | null;
    signature: File | null;
    collectionStatus: 'collected' | 'not_collected' | null;
    paymentMethod: 'efectivo' | 'qr' | 'transferencia' | null;
}

const uploadedFile = (formData: FormData, key: string): File | null => {
    const value = formData.get(key);
    return value instanceof File && value.size > 0 ? value : null;
};

/** Parsea el FormData de entrega al formato del núcleo. Compartido por action y API. */
export function parseCompletionInput(formData: FormData, base: { destinationId: number; workday: Workday; dest: Destination }): CompletionInput {
    const latitude = Number(formData.get('latitude'));
    const longitude = Number(formData.get('longitude'));
    const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

    const collectionRaw = String(formData.get('collection_status') ?? '');
    const collectionStatus = collectionRaw === 'collected' || collectionRaw === 'not_collected' ? collectionRaw : null;
    const methodRaw = String(formData.get('payment_method') ?? '');
    const paymentMethod = collectionStatus === 'collected' && ['efectivo', 'qr', 'transferencia'].includes(methodRaw)
        ? methodRaw as 'efectivo' | 'qr' | 'transferencia'
        : null;

    return {
        ...base,
        recipient: String(formData.get('recipient_name') ?? '').trim().slice(0, 120) || null,
        note: String(formData.get('pod_note') ?? '').trim().slice(0, 500) || null,
        latitude: hasPosition ? latitude : null,
        longitude: hasPosition ? longitude : null,
        photo: uploadedFile(formData, 'photo'),
        signature: uploadedFile(formData, 'signature'),
        collectionStatus,
        paymentMethod,
    };
}

/** Registra la entrega completa: POD, cobranza, notificaciones. Lanza DeliveryError. */
export async function executeCompletion(input: CompletionInput): Promise<void> {
    const { destinationId, workday, dest } = input;

    const patch: Partial<typeof destinations.$inferInsert> = {
        status: DestinationStatus.Completed,
        completedAt: new Date(),
        recipientName: input.recipient,
        podNote: input.note,
        deliveredLatitude: input.latitude,
        deliveredLongitude: input.longitude,
        collectionStatus: input.collectionStatus,
        paymentMethod: input.paymentMethod,
        updatedAt: new Date(),
    };
    if (input.photo) patch.podPhotoPath = await uploadPod(input.photo, destinationId, 'photo');
    if (input.signature) patch.podSignaturePath = await uploadPod(input.signature, destinationId, 'signature');

    const updated = await db.update(destinations).set(patch)
        .where(and(eq(destinations.id, destinationId), eq(destinations.status, DestinationStatus.Pending)))
        .returning({ id: destinations.id });
    if (!updated.length) throw new DeliveryError('Este destino ya no está pendiente.');

    try {
        await pushToAdmins(workday.companyId, {
            title: 'Entrega completada',
            body: dest.reference + (input.recipient ? ` · recibió ${input.recipient}` : ''),
            url: '/admin',
            tag: `ruo-entrega-${destinationId}`,
        });
        await notifyCompany(workday.companyId, [
            payloadFor('entregado', '', dest, { recibio: input.recipient, cobrado: input.collectionStatus === 'collected' ? 'si' : null }),
        ]);
    } catch (error) {
        console.error('[executeCompletion/push]', error);
    }
}

/** Marca la parada como fallida con su motivo. Lanza DeliveryError. */
export async function executeFailure(destinationId: number, workday: Workday, dest: Destination, reasonLabel: string): Promise<void> {
    const updated = await db.update(destinations).set({
        status: DestinationStatus.Failed,
        failureReason: reasonLabel,
        failedAt: new Date(),
        updatedAt: new Date(),
    }).where(and(eq(destinations.id, destinationId), eq(destinations.status, DestinationStatus.Pending)))
        .returning({ id: destinations.id });
    if (!updated.length) throw new DeliveryError('Este destino ya no está pendiente.');

    try {
        await pushToAdmins(workday.companyId, {
            title: 'Entrega fallida',
            body: `${dest.reference} · ${reasonLabel}`,
            url: '/admin/pedidos',
            tag: `ruo-falla-${destinationId}`,
        });
        await notifyCompany(workday.companyId, [
            payloadFor('fallido', '', dest, { motivo: reasonLabel }),
        ]);
    } catch (error) {
        console.error('[executeFailure/push]', error);
    }
}
