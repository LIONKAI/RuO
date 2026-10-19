<?php

namespace App\Services;

use App\Models\Destination;

/**
 * Customer notifications over WhatsApp.
 *
 * Generates wa.me deep links so the admin or driver can notify a customer with
 * one tap — no API keys needed. To automate delivery, swap these methods for
 * calls to the Meta WhatsApp Cloud API; the payload is already structured.
 */
class WhatsApp
{
    /**
     * wa.me link that sends the customer their live tracking URL.
     */
    public function trackingLink(Destination $destination): ?string
    {
        $number = $this->number($destination->phone);

        if ($number === null) {
            return null;
        }

        $message = "Hola, tu entrega «{$destination->reference}» está en camino. "
            ."Sigue al repartidor en vivo y mira la hora estimada de llegada aquí: {$destination->trackingUrl()}";

        return "https://wa.me/{$number}?text=".rawurlencode($message);
    }

    /**
     * wa.me link that confirms the delivery to the customer.
     */
    public function deliveredLink(Destination $destination): ?string
    {
        $number = $this->number($destination->phone);

        if ($number === null) {
            return null;
        }

        $message = "Tu entrega «{$destination->reference}» fue completada. ¡Gracias!";

        return "https://wa.me/{$number}?text=".rawurlencode($message);
    }

    /**
     * Digits-only phone number for wa.me, normalizing Bolivian mobiles.
     */
    protected function number(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        if ($digits === '') {
            return null;
        }

        return str_starts_with($digits, '591') || strlen($digits) > 8 ? $digits : '591'.$digits;
    }
}
