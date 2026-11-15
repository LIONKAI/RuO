"use server";

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { destinations, workdays } from '@/db/schema';
import { currentUser, supabaseAdmin } from '@/lib/supabase';
import { maybeCloseWorkday, optimizeWorkday } from '@/lib/queries';
import { DestinationStatus } from '@/lib/domain';

async function requireDriver() {
    const user = await currentUser();
    if (!user) redirect('/login');
    return user;
}

const fail = (msg: string): never => redirect(`/chofer?error=${encodeURIComponent(msg)}`);

async function uploadPod(file: File, destId: number, kind: 'photo' | 'signature'): Promise<string> {
    const ext = file.name.split('.').pop() ?? (kind === 'signature' ? 'png' : 'jpg');
    const path = `${destId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin().storage.from('pod').upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
    return path;
}

export async function completeDestination(formData: FormData) {
    await requireDriver();
    const id = Number(formData.get('id'));
    const workdayId = Number(formData.get('workday_id'));
    const recipient = String(formData.get('recipient_name') ?? '').trim() || null;
    const note = String(formData.get('pod_note') ?? '').trim() || null;
    const lat = Number(formData.get('latitude')) || null;
    const lng = Number(formData.get('longitude')) || null;
    const photo = formData.get('photo') as File | null;
    const signature = formData.get('signature') as File | null;

    try {
        const patch: Record<string, unknown> = {
            status: DestinationStatus.Completed,
            completedAt: new Date(),
            recipientName: recipient,
            podNote: note,
            deliveredLatitude: lat,
            deliveredLongitude: lng,
        };
        if (photo && photo.size > 0) patch.podPhotoPath = await uploadPod(photo, id, 'photo');
        if (signature && signature.size > 0) patch.podSignaturePath = await uploadPod(signature, id, 'signature');

        await db.update(destinations).set(patch).where(eq(destinations.id, id));
    } catch (e) {
        fail(e instanceof Error ? e.message : 'No se pudo completar la entrega');
    }

    const [workday] = await db.select().from(workdays).where(eq(workdays.id, workdayId));
    if (workday) {
        await maybeCloseWorkday(workday);
        const [fresh] = await db.select().from(workdays).where(eq(workdays.id, workdayId));
        if (fresh && fresh.status !== 'completed') await optimizeWorkday(fresh);
    }

    revalidatePath('/chofer');
    redirect('/chofer?ok=Entrega registrada');
}

export async function failDestination(formData: FormData) {
    await requireDriver();
    const id = Number(formData.get('id'));
    const workdayId = Number(formData.get('workday_id'));
    const reason = String(formData.get('failure_reason') ?? '').trim();
    if (!reason) fail('Selecciona un motivo de falla.');

    await db.update(destinations).set({
        status: DestinationStatus.Failed,
        failureReason: reason,
        failedAt: new Date(),
    }).where(eq(destinations.id, id));

    const [workday] = await db.select().from(workdays).where(eq(workdays.id, workdayId));
    if (workday) {
        await maybeCloseWorkday(workday);
        const [fresh] = await db.select().from(workdays).where(eq(workdays.id, workdayId));
        if (fresh && fresh.status !== 'completed') await optimizeWorkday(fresh);
    }

    revalidatePath('/chofer');
    redirect('/chofer?ok=Parada marcada como fallida');
}

export async function reportPosition(formData: FormData) {
    await requireDriver();
    const workdayId = Number(formData.get('workday_id'));
    const lat = Number(formData.get('latitude'));
    const lng = Number(formData.get('longitude'));
    if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return { ok: false };
    }

    await db.update(workdays).set({
        lastLatitude: lat,
        lastLongitude: lng,
        lastPositionAt: new Date(),
    }).where(eq(workdays.id, workdayId));

    return { ok: true };
}
