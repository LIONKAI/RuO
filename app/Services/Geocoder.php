<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Turns a street address into coordinates using OpenStreetMap Nominatim.
 */
class Geocoder
{
    /**
     * Find the coordinates of an address, or null when nothing matches.
     *
     * @return array{latitude: float, longitude: float, label: string}|null
     *
     * @throws RoutingServiceException
     */
    public function geocode(string $address): ?array
    {
        $query = $this->withDefaultCity($address);

        $result = $this->search($query);

        if ($result === null) {
            $withoutNumbers = trim(preg_replace('/\s+/', ' ', preg_replace('/\b(N[°º]?\s*)?\d+[a-zA-Z]?\b/u', '', $query)), ' ,');

            if ($withoutNumbers !== $query && $withoutNumbers !== '') {
                $result = $this->search($withoutNumbers);
            }
        }

        return $result;
    }

    /**
     * @return array{latitude: float, longitude: float, label: string}|null
     *
     * @throws RoutingServiceException
     */
    protected function search(string $query): ?array
    {
        try {
            $response = Http::baseUrl(config('services.nominatim.url'))
                ->withUserAgent(config('services.nominatim.user_agent'))
                ->acceptJson()
                ->connectTimeout(5)
                ->timeout(config('services.nominatim.timeout'))
                ->retry([200, 800], throw: false)
                ->get('/search', [
                    'q' => $query,
                    'format' => 'jsonv2',
                    'limit' => 1,
                    'countrycodes' => config('services.nominatim.country_codes'),
                    'accept-language' => 'es',
                ]);
        } catch (ConnectionException) {
            throw new RoutingServiceException('No se pudo conectar con el servicio de mapas. Revisa tu conexión a internet.');
        }

        if ($response->failed()) {
            throw new RoutingServiceException('El servicio de búsqueda de direcciones no respondió. Intenta de nuevo o marca el punto en el mapa.');
        }

        $first = $response->json('0');

        if (! is_array($first) || ! isset($first['lat'], $first['lon'])) {
            return null;
        }

        return [
            'latitude' => (float) $first['lat'],
            'longitude' => (float) $first['lon'],
            'label' => (string) ($first['display_name'] ?? $query),
        ];
    }

    protected function withDefaultCity(string $address): string
    {
        $city = (string) config('services.nominatim.default_city');

        if ($city === '' || Str::contains(Str::lower($address), Str::lower($city))) {
            return $address;
        }

        return "{$address}, {$city}";
    }
}
