<?php

namespace App\Services;

use App\Enums\WorkdayStatus;
use App\Models\Destination;
use App\Models\Workday;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Orders a workday's pending destinations with the OSRM "trip" service
 * (travelling salesman optimisation) and stores the legs of the route.
 */
class RouteOptimizer
{
    /**
     * (Re)calculate the optimal order of the pending destinations of a workday.
     *
     * The route starts where the driver actually is: the last completed
     * destination, or the vehicle's depot when the day has not started yet.
     * Without a depot, the best starting point is chosen by the service.
     *
     * @throws RoutingServiceException
     */
    public function optimize(Workday $workday): void
    {
        $destinations = $workday->destinations()->get();

        if ($destinations->isEmpty()) {
            throw new RoutingServiceException('Carga al menos un destino antes de generar la ruta.');
        }

        $completed = $destinations->filter->isCompleted()->sortBy('position')->values();
        $pending = $destinations->filter->isPending()->values();
        $anchor = $this->anchor($workday, $completed->last());

        $plan = $pending->isEmpty() ? [] : $this->plan($anchor, $pending);

        DB::transaction(function () use ($workday, $completed, $plan) {
            $position = $completed->count();

            foreach ($plan as $stop) {
                $stop['destination']->forceFill([
                    'position' => ++$position,
                    'leg_distance_meters' => $stop['distance'],
                    'leg_duration_seconds' => $stop['duration'],
                    'leg_geometry' => $stop['geometry'],
                    'leg_steps' => $stop['steps'],
                ])->save();
            }

            $workday->forceFill([
                'status' => $workday->isDraft() ? WorkdayStatus::InProgress : $workday->status,
                'route_version' => $workday->route_version + 1,
                'route_updated_at' => now(),
            ])->save();
        });

        $workday->unsetRelation('destinations');
    }

    /**
     * Where the route starts: the last stop already visited or the vehicle's depot.
     *
     * @return array{latitude: float, longitude: float}|null
     */
    protected function anchor(Workday $workday, ?Destination $lastCompleted): ?array
    {
        if ($lastCompleted !== null) {
            return ['latitude' => $lastCompleted->latitude, 'longitude' => $lastCompleted->longitude];
        }

        if ($workday->vehicle?->hasDepot()) {
            return ['latitude' => $workday->vehicle->depot_latitude, 'longitude' => $workday->vehicle->depot_longitude];
        }

        return null;
    }

    /**
     * Build the ordered list of pending stops with the leg that reaches each one.
     *
     * @param  array{latitude: float, longitude: float}|null  $anchor
     * @param  Collection<int, Destination>  $pending
     * @return list<array{destination: Destination, distance: int, duration: int, geometry: list<array{0: float, 1: float}>|null, steps: list<array{text: string, distance: int}>}>
     */
    protected function plan(?array $anchor, Collection $pending): array
    {
        $points = $anchor !== null
            ? collect([['latitude' => $anchor['latitude'], 'longitude' => $anchor['longitude'], 'destination' => null]])
            : collect();

        $pending->each(fn (Destination $destination) => $points->push([
            'latitude' => $destination->latitude,
            'longitude' => $destination->longitude,
            'destination' => $destination,
        ]));

        if ($points->count() === 1) {
            return [$this->stop($pending->first(), null)];
        }

        $trip = $this->requestTrip($points, startsAtAnchor: $anchor !== null);

        $order = collect($trip['waypoints'])
            ->map(fn (array $waypoint, int $inputIndex) => ['input' => $inputIndex, 'trip' => $waypoint['waypoint_index']])
            ->sortBy('trip')
            ->pluck('input')
            ->values()
            ->all();

        $legs = $trip['trips'][0]['legs'];

        if ($anchor !== null) {
            $stops = [];

            foreach (array_slice($order, 1) as $tripPosition => $inputIndex) {
                $stops[] = $this->stop($points[$inputIndex]['destination'], $legs[$tripPosition]);
            }

            return $stops;
        }

        return $this->openRoundTrip($points, $order, $legs);
    }

    /**
     * Turn a round trip into the shortest open path by dropping its longest leg.
     *
     * @param  Collection<int, array{latitude: float, longitude: float, destination: Destination|null}>  $points
     * @param  list<int>  $order
     * @param  list<array<string, mixed>>  $legs
     * @return list<array{destination: Destination, distance: int, duration: int, geometry: list<array{0: float, 1: float}>|null, steps: list<array{text: string, distance: int}>}>
     */
    protected function openRoundTrip(Collection $points, array $order, array $legs): array
    {
        $count = count($order);
        $longestLeg = collect($legs)->sortByDesc('distance')->keys()->first();
        $start = ($longestLeg + 1) % $count;

        $stops = [$this->stop($points[$order[$start]]['destination'], null)];

        for ($offset = 1; $offset < $count; $offset++) {
            $tripPosition = ($start + $offset) % $count;
            $previousLeg = ($tripPosition - 1 + $count) % $count;

            $stops[] = $this->stop($points[$order[$tripPosition]]['destination'], $legs[$previousLeg]);
        }

        return $stops;
    }

    /**
     * @param  Collection<int, array{latitude: float, longitude: float, destination: Destination|null}>  $points
     * @return array{waypoints: list<array<string, mixed>>, trips: list<array<string, mixed>>}
     *
     * @throws RoutingServiceException
     */
    protected function requestTrip(Collection $points, bool $startsAtAnchor): array
    {
        $coordinates = $points
            ->map(fn (array $point) => sprintf('%.6F,%.6F', $point['longitude'], $point['latitude']))
            ->implode(';');

        $profile = config('services.osrm.profile');

        try {
            $response = Http::baseUrl(config('services.osrm.url'))
                ->acceptJson()
                ->connectTimeout(5)
                ->timeout(config('services.osrm.timeout'))
                ->retry([300, 1000], throw: false)
                ->get("/trip/v1/{$profile}/{$coordinates}", [
                    'roundtrip' => $startsAtAnchor ? 'false' : 'true',
                    'source' => $startsAtAnchor ? 'first' : 'any',
                    'destination' => 'any',
                    'steps' => 'true',
                    'geometries' => 'geojson',
                    'overview' => 'false',
                ]);
        } catch (ConnectionException) {
            throw new RoutingServiceException('No se pudo conectar con el servicio de rutas. Revisa tu conexión a internet e intenta de nuevo.');
        }

        if ($response->failed() || $response->json('code') !== 'Ok' || empty($response->json('trips.0.legs'))) {
            throw new RoutingServiceException('No se pudo calcular la ruta óptima. Verifica que los destinos estén bien ubicados en el mapa e intenta de nuevo.');
        }

        return [
            'waypoints' => $response->json('waypoints'),
            'trips' => $response->json('trips'),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $leg
     * @return array{destination: Destination, distance: int, duration: int, geometry: list<array{0: float, 1: float}>|null, steps: list<array{text: string, distance: int}>}
     */
    protected function stop(Destination $destination, ?array $leg): array
    {
        if ($leg === null) {
            return ['destination' => $destination, 'distance' => 0, 'duration' => 0, 'geometry' => null, 'steps' => []];
        }

        $geometry = [];
        $steps = [];

        foreach ($leg['steps'] ?? [] as $step) {
            foreach ($step['geometry']['coordinates'] ?? [] as [$longitude, $latitude]) {
                $point = [round($latitude, 6), round($longitude, 6)];

                if (end($geometry) !== $point) {
                    $geometry[] = $point;
                }
            }

            $steps[] = [
                'text' => DirectionsTranslator::instruction($step),
                'distance' => (int) round($step['distance'] ?? 0),
            ];
        }

        return [
            'destination' => $destination,
            'distance' => (int) round($leg['distance'] ?? 0),
            'duration' => (int) round($leg['duration'] ?? 0),
            'geometry' => $geometry ?: null,
            'steps' => $steps,
        ];
    }
}
