<?php

namespace App\Services;

use App\Enums\WorkdayStatus;
use App\Models\Destination;
use App\Models\Vehicle;
use App\Models\Workday;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Vehicle routing: splits a pool of deliveries among the fleet and starts
 * an optimized route for every vehicle that received stops.
 *
 * The split is geographic (k-means over coordinates with deterministic seeds),
 * then each cluster is assigned to the vehicle whose depot is closest to the
 * cluster centroid. Vehicles without a depot take the remaining clusters.
 */
class FleetOptimizer
{
    public function __construct(
        protected RouteOptimizer $optimizer,
    ) {}

    /**
     * Distribute the pool destinations of a date among the given vehicles and
     * (re)optimize each vehicle's workday. Destinations join any pending stops
     * when the workday is already running.
     *
     * @param  Collection<int, Vehicle>  $vehicles
     * @return array{assigned: int, routes: int}
     *
     * @throws RoutingServiceException
     */
    public function distribute(string $date, Collection $vehicles): array
    {
        $pool = Destination::query()->inPool($date)->get();

        if ($pool->isEmpty()) {
            throw new RoutingServiceException('No hay pedidos pendientes de repartir en esa fecha.');
        }

        if ($vehicles->isEmpty()) {
            throw new RoutingServiceException('No hay vehículos disponibles para repartir.');
        }

        $groups = $this->split($pool, $vehicles->values());
        $fleet = $vehicles->keyBy('id');

        return DB::transaction(function () use ($groups, $date, $fleet) {
            $assigned = 0;
            $routes = 0;

            foreach ($groups as $vehicleId => $destinations) {
                if ($destinations->isEmpty()) {
                    continue;
                }

                $workday = $fleet->get($vehicleId)->workdayFor($date);

                if ($workday->isCompleted()) {
                    $workday->forceFill([
                        'status' => WorkdayStatus::InProgress,
                        'completed_at' => null,
                        'total_km' => null,
                        'estimated_fuel_liters' => null,
                    ])->save();
                }

                $destinations->each(fn (Destination $destination) => $destination->forceFill(['workday_id' => $workday->id])->save());
                $assigned += $destinations->count();

                $workday->unsetRelation('destinations');
                $this->optimizer->optimize($workday);
                $routes++;
            }

            return ['assigned' => $assigned, 'routes' => $routes];
        });
    }

    /**
     * Split the pool into one group per vehicle.
     *
     * @param  Collection<int, Destination>  $pool
     * @param  Collection<int, Vehicle>  $vehicles
     * @return array<int, Collection<int, Destination>> keyed by vehicle id
     */
    protected function split(Collection $pool, Collection $vehicles): array
    {
        if ($vehicles->count() === 1) {
            return [$vehicles->first()->id => $pool->values()];
        }

        $clusters = $this->clusters($pool, $vehicles->count());

        $pairs = collect();
        foreach ($clusters as $index => $cluster) {
            foreach ($vehicles->filter->hasDepot() as $vehicle) {
                $pairs->push([
                    'cluster' => $index,
                    'vehicle' => $vehicle,
                    'distance' => self::distance(
                        [$cluster['centroid'][0], $cluster['centroid'][1]],
                        [$vehicle->depot_latitude, $vehicle->depot_longitude],
                    ),
                ]);
            }
        }

        $groups = [];
        $usedClusters = [];
        $usedVehicles = [];

        foreach ($pairs->sortBy('distance') as $pair) {
            if (isset($usedClusters[$pair['cluster']]) || isset($usedVehicles[$pair['vehicle']->id])) {
                continue;
            }

            $usedClusters[$pair['cluster']] = true;
            $usedVehicles[$pair['vehicle']->id] = true;
            $groups[$pair['vehicle']->id] = $clusters[$pair['cluster']]['items'];
        }

        $remainingClusters = collect(array_keys($clusters))->reject(fn (int $index) => isset($usedClusters[$index]))->values();
        $remainingVehicles = $vehicles->reject(fn (Vehicle $vehicle) => isset($usedVehicles[$vehicle->id]))->values();

        foreach ($remainingVehicles as $index => $vehicle) {
            $groups[$vehicle->id] = $clusters[$remainingClusters[$index]]['items'];
        }

        return $groups;
    }

    /**
     * Partition the pool into $k geographic clusters. Lloyd's algorithm over
     * haversine distance; seeds are spread over longitude so the result is
     * deterministic. Empty clusters steal the farthest member of the biggest one.
     *
     * @param  Collection<int, Destination>  $pool
     * @return list<array{centroid: array{0: float, 1: float}, items: Collection<int, Destination>}>
     */
    protected function clusters(Collection $pool, int $k): array
    {
        $sorted = $pool->sortBy('longitude')->values();
        $last = $sorted->count() - 1;
        $centroids = collect(range(0, $k - 1))
            ->map(fn (int $i) => $sorted[(int) round($i * $last / max($k - 1, 1))])
            ->map(fn (Destination $destination) => [$destination->latitude, $destination->longitude])
            ->all();

        $membership = array_fill(0, $sorted->count(), 0);

        for ($iteration = 0; $iteration < 15; $iteration++) {
            $membership = $sorted
                ->map(fn (Destination $destination) => $this->nearest($centroids, [$destination->latitude, $destination->longitude]))
                ->all();

            $next = [];
            foreach (range(0, $k - 1) as $i) {
                $members = $sorted->filter(fn (Destination $destination, int $index) => $membership[$index] === $i);
                $next[$i] = $members->isEmpty()
                    ? $centroids[$i]
                    : [(float) $members->avg('latitude'), (float) $members->avg('longitude')];
            }

            if ($next === $centroids) {
                break;
            }

            $centroids = $next;
        }

        $clusters = [];
        foreach (range(0, $k - 1) as $i) {
            $clusters[] = [
                'centroid' => $centroids[$i],
                'items' => $sorted->filter(fn (Destination $destination, int $index) => $membership[$index] === $i)->values(),
            ];
        }

        foreach ($clusters as $i => $cluster) {
            if ($cluster['items']->isNotEmpty()) {
                continue;
            }

            $biggest = collect($clusters)->sortByDesc(fn (array $c) => $c['items']->count())->keys()->first();
            $stolen = $clusters[$biggest]['items']->pop();
            $clusters[$i]['items']->push($stolen);
            $clusters[$i]['centroid'] = [$stolen->latitude, $stolen->longitude];
        }

        return $clusters;
    }

    /**
     * Index of the centroid nearest to the point.
     *
     * @param  list<array{0: float, 1: float}>  $centroids
     * @param  array{0: float, 1: float}  $point
     */
    protected function nearest(array $centroids, array $point): int
    {
        $best = 0;
        $bestDistance = PHP_FLOAT_MAX;

        foreach ($centroids as $index => $centroid) {
            $distance = self::distance($point, $centroid);

            if ($distance < $bestDistance) {
                $best = $index;
                $bestDistance = $distance;
            }
        }

        return $best;
    }

    /**
     * Haversine distance between two [lat, lng] points, in meters.
     *
     * @param  array{0: float, 1: float}  $a
     * @param  array{0: float, 1: float}  $b
     */
    public static function distance(array $a, array $b): float
    {
        $earth = 6371000;
        $lat = deg2rad($b[0] - $a[0]);
        $lng = deg2rad($b[1] - $a[1]);

        $h = sin($lat / 2) ** 2 + cos(deg2rad($a[0])) * cos(deg2rad($b[0])) * sin($lng / 2) ** 2;

        return 2 * $earth * asin(sqrt($h));
    }
}
