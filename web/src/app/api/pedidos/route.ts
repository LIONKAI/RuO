import { db } from '@/db';
import { destinations } from '@/db/schema';
import { isAuthorizedApiRequest, unauthorized } from '@/lib/api-auth';
import { geocode } from '@/lib/services/geocoder';
import { RoutingServiceError } from '@/lib/services/osrm';
import { trackingUrl } from '@/lib/queries';
import { isIsoDate, todayIso } from '@/lib/domain';

/**
 * POST /api/pedidos — registra un pedido en la cola del día (pool).
 * Lo usa el bot de n8n cuando el cliente confirma su pedido.
 *
 * Body JSON:
 *   cliente    (string, obligatorio)  nombre de quien recibe
 *   direccion  (string, obligatorio)  dirección de entrega
 *   telefono   (string, opcional)
 *   detalle    (string, opcional)     productos, total, forma de pago
 *   fecha      (YYYY-MM-DD, opcional) hoy en Bolivia por defecto
 *   latitud / longitud (opcional)     si el cliente compartió ubicación
 */
export async function POST(request: Request) {
    if (!isAuthorizedApiRequest(request)) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
        return Response.json({ ok: false, error: 'El cuerpo debe ser JSON.' }, { status: 400 });
    }

    const text = (key: string, max: number) => String(body[key] ?? '').trim().slice(0, max);
    const cliente = text('cliente', 60);
    const direccion = text('direccion', 300);
    const telefono = text('telefono', 30) || null;
    const detalle = text('detalle', 200);
    const fecha = isIsoDate(body.fecha) ? body.fecha : todayIso();

    if (!cliente || !direccion) {
        return Response.json({ ok: false, error: 'Faltan datos: "cliente" y "direccion" son obligatorios.' }, { status: 422 });
    }

    const latitude = Number(body.latitud);
    const longitude = Number(body.longitud);
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

    let coords: { latitude: number; longitude: number } | null;
    try {
        coords = hasCoords ? { latitude, longitude } : await geocode(direccion);
    } catch (error) {
        const message = error instanceof RoutingServiceError ? error.message : 'El servicio de mapas no respondió.';
        return Response.json({ ok: false, error: message }, { status: 502 });
    }

    if (!coords) {
        return Response.json({
            ok: false,
            error: `No se encontró «${direccion}» en el mapa. Pide al cliente una referencia más precisa (calle, número, anillo, barrio) o su ubicación.`,
        }, { status: 422 });
    }

    const reference = (detalle ? `${cliente} — ${detalle}` : cliente).slice(0, 120);

    const [created] = await db.insert(destinations).values({
        address: direccion,
        reference,
        phone: telefono,
        latitude: coords.latitude,
        longitude: coords.longitude,
        serviceDate: fecha,
    }).returning({ id: destinations.id, publicToken: destinations.publicToken });

    const origin = new URL(request.url).origin;

    return Response.json({
        ok: true,
        id: created.id,
        token: created.publicToken,
        referencia: reference,
        direccion,
        fecha,
        link_seguimiento: trackingUrl(created.publicToken, origin),
    }, { status: 201 });
}
