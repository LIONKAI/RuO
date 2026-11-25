import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles, workdays } from '@/db/schema';
import { companyForApiRequest, unauthorized } from '@/lib/api-auth';
import { destinationByToken, destinationsOf, etaFor, trackingUrl } from '@/lib/queries';
import { DestinationStatus, WorkdayStatus, destinationStatusLabel, formatTime, type DestinationStatus as Status } from '@/lib/domain';

/**
 * GET /api/pedidos/{token} — estado de un pedido para el bot
 * ("¿dónde está mi pedido?"): estado, paradas antes y hora estimada.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
    const company = await companyForApiRequest(request);
    if (!company) return unauthorized();

    const { token } = await params;
    const dest = await destinationByToken(token);
    // El token solo se revela si el pedido pertenece a la empresa de la key.
    if (!dest || dest.companyId !== company.id) {
        return Response.json({ ok: false, error: 'Pedido no encontrado.' }, { status: 404 });
    }

    const [workday] = dest.workdayId ? await db.select().from(workdays).where(eq(workdays.id, dest.workdayId)) : [];
    const [vehicle] = workday ? await db.select().from(vehicles).where(eq(vehicles.id, workday.vehicleId)) : [];
    const route = workday ? await destinationsOf(workday.id) : [];

    const pending = dest.status === DestinationStatus.Pending;
    const paradasAntes = pending && workday
        ? route.filter((d) => d.status === DestinationStatus.Pending && (d.position ?? 0) < (dest.position ?? 0)).length
        : null;
    const eta = pending && workday?.status === WorkdayStatus.InProgress ? etaFor(route, dest) : null;

    const resumen = !workday
        ? 'Pedido recibido; todavía no fue asignado a un repartidor.'
        : dest.status === DestinationStatus.Completed
            ? 'Pedido entregado.'
            : dest.status === DestinationStatus.Failed
                ? `No se pudo entregar (${dest.failureReason ?? 'sin motivo'}).`
                : workday.status !== WorkdayStatus.InProgress
                    ? 'Pedido asignado; el repartidor aún no sale.'
                    : paradasAntes === 0
                        ? 'El repartidor va en camino.'
                        : `El repartidor está en ruta; faltan ${paradasAntes} parada(s) antes.`;

    return Response.json({
        ok: true,
        estado: dest.status,
        estado_texto: destinationStatusLabel[dest.status as Status],
        resumen,
        referencia: dest.reference,
        direccion: dest.address,
        fecha: dest.serviceDate,
        vehiculo: vehicle ? vehicle.name : null,
        paradas_antes: paradasAntes,
        hora_estimada: eta ? formatTime(eta) : null,
        entregado_a_las: dest.completedAt ? formatTime(dest.completedAt) : null,
        link_seguimiento: trackingUrl(dest.publicToken, new URL(request.url).origin),
    });
}
