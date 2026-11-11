// Notificaciones por WhatsApp vía deep links wa.me — sin API keys.
// Para automatizar con Meta Cloud API, reemplazar estas funciones;
// el payload ya está estructurado. Port de App\Services\WhatsApp.

/** Número solo-dígitos para wa.me, normalizando móviles bolivianos. */
function number(phone: string | null | undefined): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (digits === '') return null;
    return digits.startsWith('591') || digits.length > 8 ? digits : `591${digits}`;
}

interface DeliveryInfo {
    phone?: string | null;
    reference: string;
}

/** Link que envía al cliente su URL de tracking en vivo. */
export function trackingLink(delivery: DeliveryInfo, trackingUrl: string): string | null {
    const n = number(delivery.phone);
    if (n === null) return null;

    const message =
        `Hola, tu entrega «${delivery.reference}» está en camino. ` +
        `Sigue al repartidor en vivo y mira la hora estimada de llegada aquí: ${trackingUrl}`;

    return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

/** Link que confirma la entrega al cliente. */
export function deliveredLink(delivery: DeliveryInfo): string | null {
    const n = number(delivery.phone);
    if (n === null) return null;

    return `https://wa.me/${n}?text=${encodeURIComponent(`Tu entrega «${delivery.reference}» fue completada. ¡Gracias!`)}`;
}
