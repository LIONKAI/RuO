import type { Coordinates } from '@/lib/domain';
import { RoutingServiceError } from './osrm';

/**
 * Geocodificación con Nominatim (OpenStreetMap), restringida a Bolivia
 * y con sesgo a Santa Cruz — port de App\Services\Geocoder.
 *
 * Devuelve null si la dirección no existe en el mapa y lanza
 * RoutingServiceError si el servicio no responde.
 */
export async function geocode(address: string): Promise<Coordinates | null> {
    const base = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';
    const city = process.env.RUO_DEFAULT_CITY ?? 'Santa Cruz';
    const query = address.toLowerCase().includes(city.toLowerCase()) ? address : `${address}, ${city}`;
    const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        countrycodes: process.env.NOMINATIM_COUNTRY_CODES ?? 'bo',
        'accept-language': 'es',
        limit: '1',
    });

    let response: Response;
    try {
        response = await fetch(`${base}/search?${params}`, {
            headers: {
                'User-Agent': process.env.NOMINATIM_USER_AGENT ?? 'RuO/1.0 (contacto: admin@ruo.com)',
            },
            signal: AbortSignal.timeout(Number(process.env.NOMINATIM_TIMEOUT ?? 10) * 1000),
            cache: 'no-store',
        });
    } catch {
        throw new RoutingServiceError('No se pudo conectar con el servicio de mapas. Intenta de nuevo o pega las coordenadas.');
    }

    if (!response.ok) {
        throw new RoutingServiceError('El servicio de búsqueda de direcciones no respondió. Intenta de nuevo o pega las coordenadas.');
    }

    const results = (await response.json().catch(() => [])) as { lat: string; lon: string }[];
    const first = results[0];

    return first ? { latitude: Number(first.lat), longitude: Number(first.lon) } : null;
}
