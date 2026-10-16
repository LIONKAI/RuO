<?php

namespace App\Services;

use App\Enums\DestinationStatus;
use App\Enums\WorkdayStatus;
use App\Models\Destination;
use App\Models\Workday;
use Illuminate\Support\Facades\DB;

/**
 * Business rules of a workday: adding destinations, completing them and closing the day.
 */
class WorkdayManager
{
    public function __construct(
        protected Geocoder $geocoder,
        protected RouteOptimizer $optimizer,
    ) {}

    /**
     * Resolve coordinates for the submitted destination data when the admin did not pick them on the map.
     *
     * @param  array{address: string, reference: string, latitude?: float|string|null, longitude?: float|string|null}  $data
     * @return array{address: string, reference: string, latitude: float, longitude: float}
     *
     * @throws RoutingServiceException
     */
    public function resolveCoordinates(array $data): array
    {
        if (filled($data['latitude'] ?? null) && filled($data['longitude'] ?? null)) {
            return [
                'address' => $data['address'],
                'reference' => $data['reference'],
                'latitude' => (float) $data['latitude'],
                'longitude' => (float) $data['longitude'],
            ];
        }

        $location = $this->geocoder->geocode($data['address']);

        if ($location === null) {
            throw new RoutingServiceException('No encontramos esa dirección. Márcala haciendo clic en el mapa y vuelve a guardar.');
        }

        return [
            'address' => $data['address'],
            'reference' => $data['reference'],
            'latitude' => $location['latitude'],
            'longitude' => $location['longitude'],
        ];
    }

    /**
     * Add a planned destination to a workday whose route was not generated yet.
     *
     * @param  array{address: string, reference: string, latitude: float, longitude: float}  $data
     */
    public function addPlanned(Workday $workday, array $data): Destination
    {
        return $workday->destinations()->create($data);
    }

    /**
     * Add an unplanned destination and immediately recalculate the route.
     *
     * @param  array{address: string, reference: string, latitude: float, longitude: float}  $data
     *
     * @throws RoutingServiceException
     */
    public function addUnplanned(Workday $workday, array $data): Destination
    {
        return DB::transaction(function () use ($workday, $data) {
            $destination = $workday->destinations()->create([...$data, 'is_unplanned' => true]);

            if ($workday->isCompleted()) {
                $workday->forceFill([
                    'status' => WorkdayStatus::InProgress,
                    'completed_at' => null,
                    'total_km' => null,
                    'estimated_fuel_liters' => null,
                ])->save();
            }

            $this->optimizer->optimize($workday);

            return $destination;
        });
    }

    /**
     * Mark a destination as visited and close the workday when nothing is left.
     */
    public function complete(Destination $destination): void
    {
        DB::transaction(function () use ($destination) {
            $destination->forceFill([
                'status' => DestinationStatus::Completed,
                'completed_at' => now(),
            ])->save();

            $workday = $destination->workday()->lockForUpdate()->first();
            $workday->load('vehicle', 'destinations');

            $hasPending = $workday->destinations->contains(fn (Destination $item) => $item->isPending());

            $workday->forceFill(['route_version' => $workday->route_version + 1]);

            if (! $hasPending) {
                $totalKm = $workday->routeKm();

                $workday->forceFill([
                    'status' => WorkdayStatus::Completed,
                    'completed_at' => now(),
                    'total_km' => $totalKm,
                    'estimated_fuel_liters' => $workday->fuelForKm($totalKm),
                ]);
            }

            $workday->save();
        });
    }
}
