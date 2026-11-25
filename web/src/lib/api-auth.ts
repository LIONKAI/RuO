import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { companies, type Company } from '@/db/schema';

/**
 * Autenticación de la API para integraciones (n8n, bots de WhatsApp).
 * Cada empresa tiene su propia api_key (visible en /admin/config): el cliente
 * envía `Authorization: Bearer <api_key>` y la key identifica a qué empresa
 * pertenece el pedido. Empresas suspendidas quedan rechazadas automáticamente.
 */
export async function companyForApiRequest(request: Request): Promise<Company | null> {
    const header = request.headers.get('authorization') ?? '';
    const key = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (key.length < 24) return null;

    const [company] = await db.select().from(companies)
        .where(and(eq(companies.apiKey, key), eq(companies.active, true)))
        .limit(1);
    return company ?? null;
}

export const unauthorized = () =>
    Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
