import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Autenticación de la API para integraciones (n8n, bots).
 * El cliente envía `Authorization: Bearer <RUO_API_KEY>`.
 */
export function isAuthorizedApiRequest(request: Request): boolean {
    const expected = process.env.RUO_API_KEY ?? '';
    if (expected.length < 24) return false; // sin clave configurada, la API queda cerrada

    const header = request.headers.get('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export const unauthorized = () =>
    Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
