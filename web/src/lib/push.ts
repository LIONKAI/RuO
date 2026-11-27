import 'server-only';
import webpush from 'web-push';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, pushSubscriptions } from '@/db/schema';

/**
 * Envío de notificaciones push (Web Push / VAPID). Si las claves no están
 * configuradas el envío se omite silenciosamente: la app sigue funcionando
 * sin push (p.ej. entornos de desarrollo sin claves).
 */

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}

function configured() {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return null;
    webpush.setVapidDetails('mailto:soporte@ruo.app', pub, priv);
    return true;
}

async function sendToEndpoints(
    subs: { id: number; endpoint: string; p256dh: string; auth: string }[],
    payload: PushPayload,
) {
    if (!configured() || subs.length === 0) return;
    const message = JSON.stringify(payload);
    const staleIds: number[] = [];

    await Promise.allSettled(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    message,
                );
            } catch (err) {
                const status = (err as { statusCode?: number }).statusCode;
                // 404/410: la suscripción expiró o el usuario revocó el permiso — limpiar.
                if (status === 404 || status === 410) staleIds.push(sub.id);
                else console.error('[push] error al enviar:', status ?? err);
            }
        }),
    );

    if (staleIds.length > 0) {
        await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, staleIds));
    }
}

/** Notifica a todos los dispositivos suscritos de un perfil. */
export async function pushToProfile(profileId: string, payload: PushPayload) {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.profileId, profileId));
    await sendToEndpoints(subs, payload);
}

/** Notifica a todos los admins activos de una empresa. */
export async function pushToAdmins(companyId: string, payload: PushPayload) {
    const admins = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.companyId, companyId), eq(profiles.role, 'admin')));
    const adminIds = admins.map((a) => a.id);
    if (adminIds.length === 0) return;
    const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.profileId, adminIds));
    await sendToEndpoints(subs, payload);
}
