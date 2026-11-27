import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { companies, type Destination } from '@/db/schema';
import { trackingUrl } from '@/lib/queries';

/**
 * Webhook saliente por empresa: cuando un pedido cambia de estado se hace
 * POST al endpoint de n8n de la empresa, que formatea y envía el WhatsApp.
 * Nunca lanza errores ni bloquea la acción principal: una falla del webhook
 * no puede romper una entrega.
 */

export type NotifyEvent = 'en_camino' | 'entregado' | 'fallido';

export interface NotifyPayload {
    evento: NotifyEvent;
    empresa: string;
    pedido: {
        referencia: string;
        direccion: string;
        telefono: string | null;
        link: string;
    };
    detalle?: Record<string, string | number | null>;
}

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://ruo-lac.vercel.app';

export function payloadFor(evento: NotifyEvent, companyName: string, dest: Destination, detalle?: NotifyPayload['detalle']): NotifyPayload {
    return {
        evento,
        empresa: companyName,
        pedido: {
            referencia: dest.reference,
            direccion: dest.address,
            telefono: dest.phone,
            link: trackingUrl(dest.publicToken, base()),
        },
        detalle,
    };
}

/** POST al webhook de la empresa con timeout de 8s. Silencioso por diseño. */
export async function notifyCompany(companyId: string, payloads: NotifyPayload[]) {
    if (payloads.length === 0) return;
    try {
        const [company] = await db.select({ url: companies.notifyWebhookUrl, name: companies.name }).from(companies).where(eq(companies.id, companyId));
        if (!company?.url) return;

        const body = payloads.map((p) => ({ ...p, empresa: company.name }));
        await fetch(company.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body.length === 1 ? body[0] : body),
            signal: AbortSignal.timeout(8000),
        });
    } catch (error) {
        console.error('[notifyCompany] webhook falló:', error instanceof Error ? error.message : error);
    }
}
