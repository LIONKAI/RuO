import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { currentUser } from '@/lib/supabase';

/**
 * POST /api/push — registra la suscripción push del dispositivo actual.
 * DELETE /api/push — la elimina (el usuario desactiva notificaciones).
 * Requiere sesión; la suscripción queda ligada al perfil autenticado.
 */
export async function POST(request: Request) {
    const user = await currentUser();
    if (!user) return Response.json({ ok: false }, { status: 401 });

    const body = (await request.json().catch(() => null)) as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
    } | null;
    const endpoint = body?.endpoint?.slice(0, 500);
    const p256dh = body?.keys?.p256dh?.slice(0, 200);
    const auth = body?.keys?.auth?.slice(0, 100);
    if (!endpoint || !p256dh || !auth) {
        return Response.json({ ok: false, error: 'Suscripción inválida.' }, { status: 422 });
    }

    await db
        .insert(pushSubscriptions)
        .values({ profileId: user.id, endpoint, p256dh, auth })
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { profileId: user.id, p256dh, auth } });

    return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
    const user = await currentUser();
    if (!user) return Response.json({ ok: false }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
    if (body?.endpoint) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint.slice(0, 500)));
    }
    return Response.json({ ok: true });
}
