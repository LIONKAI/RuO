import type { Coordinates } from '@/lib/domain';

/**
 * Geocodificación con Nominatim (OpenStreetMap), restringida a Bolivia
 * y con sesgo a Santa Cruz — port de App\Services\Geocoder.
 */
export async function geocode(address: string): Promise<Coordinates | null> {
    const base = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';
    const city = process.env.RUO_DEFAULT_CITY ?? 'Santa Cruz';
    const params = new URLSearchParams({
        format: 'jsonv2',
        q: `${address}, ${city}`,
        countrycodes: process.env.NOMINATIM_COUNTRY_CODES ?? 'bo',
        'accept-language': 'es',
        limit: '1',
    });

    const response = await fetch(`${base}/search?${params}`, {
        headers: {
            'User-Agent': process.env.NOMINATIM_USER_AGENT ?? 'RuO/1.0 (contacto: admin@ruo.com)',
        },
        signal: AbortSignal.timeout(Number(process.env.NOMINATIM_TIMEOUT ?? 10) * 1000),
        cache: 'no-store',
    });

    if (!response.ok) return null;

    const results: { lat: string; lon: string }[] = await response.json();
    const first = results[0];

    return first ? { latitude: Number(first.lat), longitude: Number(first.lon) } : null;
}
