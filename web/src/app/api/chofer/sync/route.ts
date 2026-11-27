import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { vehicles } from '@/db/schema';
import { currentUser } from '@/lib/supabase';
import { failureReasons, UserRole } from '@/lib/domain';
import {
    DeliveryError,
    authorizeStopData,
    closeStopAndOptimize,
    executeCompletion,
    executeFailure,
    parseCompletionInput,
} from '@/lib/delivery';

/**
 * POST /api/chofer/sync — endpoint de sincronización offline. Mismo núcleo que
 * las server actions, pero responde JSON en vez de redirigir: la cola del
 * navegador reenvía aquí las entregas registradas sin señal.
 *
 * Body: FormData con `tipo` = completar | fallar, `id` de la parada y los
 * campos de la entrega (incluye foto/firma como archivos si las hay).
 */
export async function POST(request: Request) {
    const user = await currentUser();
    if (!user || user.role !== UserRole.Driver) {
        return Response.json({ ok: false, error: 'Sesión no válida.' }, { status: 401 });
    }
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, user.id));

    const formData = await request.formData().catch(() => null);
    if (!formData) return Response.json({ ok: false, error: 'Cuerpo inválido.' }, { status: 400 });

    const destinationId = Number(formData.get('id'));
    const tipo = String(formData.get('tipo') ?? '');

    const auth = await authorizeStopData(vehicle?.id ?? null, Number.isFinite(destinationId) ? destinationId : null);
    if ('error' in auth) {
        // Si la parada ya fue cerrada por otro camino, la cola debe descartarla:
        // devolvemos 200 con descartar=true para que no se reintente eternamente.
        const descartar = auth.error.includes('pendiente') || auth.error.includes('encontrada');
        return Response.json({ ok: false, error: auth.error, descartar }, { status: descartar ? 200 : 403 });
    }

    try {
        if (tipo === 'completar') {
            await executeCompletion(parseCompletionInput(formData, auth));
        } else if (tipo === 'fallar') {
            const reasonKey = String(formData.get('failure_reason') ?? '');
            if (!(reasonKey in failureReasons)) {
                return Response.json({ ok: false, error: 'Motivo inválido.', descartar: true }, { status: 200 });
            }
            await executeFailure(auth.destinationId, auth.workday, auth.dest, failureReasons[reasonKey]);
        } else {
            return Response.json({ ok: false, error: 'Tipo desconocido.', descartar: true }, { status: 200 });
        }

        try {
            await closeStopAndOptimize(auth.workday);
        } catch (error) {
            console.error('[sync/optimize]', error);
        }
        return Response.json({ ok: true });
    } catch (error) {
        console.error('[sync]', error);
        const message = error instanceof DeliveryError ? error.message : 'Error del servidor.';
        // Destino ya cerrado: también se descarta.
        const descartar = message.includes('pendiente');
        return Response.json({ ok: false, error: message, descartar }, { status: descartar ? 200 : 500 });
    }
}
