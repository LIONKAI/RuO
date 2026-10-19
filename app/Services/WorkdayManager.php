<?php

namespace App\Services;

use App\Enums\DestinationStatus;
use App\Enums\WorkdayStatus;
use App\Models\Destination;
use App\Models\Workday;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
     * @param  array{address: string, reference: string, phone?: string|null, latitude?: float|string|null, longitude?: float|string|null}  $data
     * @return array{address: string, reference: string, phone: string|null, latitude: float, longitude: float}
     *
     * @throws RoutingServiceException
     */
    public function resolveCoordinates(array $data): array
    {
        $resolved = [
            'address' => $data['address'],
            'reference' => $data['reference'],
            'phone' => $data['phone'] ?? null,
        ];

        if (filled($data['latitude'] ?? null) && filled($data['longitude'] ?? null)) {
            return [...$resolved, 'latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude']];
        }

        $location = $this->geocoder->geocode($data['address']);

        if ($location === null) {
            throw new RoutingServiceException('No encontramos esa dirección. Márcala haciendo clic en el mapa y vuelve a guardar.');
        }

        return [...$resolved, 'latitude' => $location['latitude'], 'longitude' => $location['longitude']];
    }

    /**
     * Add a planned destination to a workday whose route was not generated yet.
     *
     * @param  array{address: string, reference: string, phone?: string|null, latitude: float, longitude: float}  $data
     */
    public function addPlanned(Workday $workday, array $data): Destination
    {
        return $workday->destinations()->create($data);
    }

    /**
     * Add an unplanned destination and immediately recalculate the route.
     *
     * @param  array{address: string, reference: string, phone?: string|null, latitude: float, longitude: float}  $data
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
     * Mark a destination as visited, storing the proof of delivery, and close
     * the workday when nothing is left.
     *
     * @param  array{recipient_name?: string|null, note?: string|null, photo?: UploadedFile|null, signature?: string|null, latitude?: float|null, longitude?: float|null}  $proof
     */
    public function complete(Destination $destination, array $proof = []): void
    {
        DB::transaction(function () use ($destination, $proof) {
            $paths = $this->storeProof($destination, $proof);

            $destination->forceFill([
                'status' => DestinationStatus::Completed,
                'completed_at' => now(),
                'recipient_name' => $proof['recipient_name'] ?? null,
                'pod_note' => $proof['note'] ?? null,
                'pod_photo_path' => $paths['photo'] ?? null,
                'pod_signature_path' => $paths['signature'] ?? null,
                'delivered_latitude' => $proof['latitude'] ?? null,
                'delivered_longitude' => $proof['longitude'] ?? null,
            ])->save();

            $this->syncWorkday($destination);
        });
    }

    /**
     * Mark the active destination as failed (customer absent, wrong address...)
     * and close the workday when nothing is left.
     */
    public function fail(Destination $destination, string $reason): void
    {
        DB::transaction(function () use ($destination, $reason) {
            $destination->forceFill([
                'status' => DestinationStatus::Failed,
                'failure_reason' => $reason,
            ])->save();

            $this->syncWorkday($destination);
        });
    }

    /**
     * Send a failed destination back to the pool so it can be served another day.
     */
    public function requeue(Destination $destination, string $date): void
    {
        $destination->forceFill([
            'workday_id' => null,
            'service_date' => $date,
            'status' => DestinationStatus::Pending,
            'position' => null,
            'leg_distance_meters' => null,
            'leg_duration_seconds' => null,
            'leg_geometry' => null,
            'leg_steps' => null,
            'failure_reason' => null,
            'is_unplanned' => false,
        ])->save();
    }

    /**
     * Store the driver's last GPS position of the running workday.
     */
    public function recordPosition(Workday $workday, float $latitude, float $longitude): void
    {
        $workday->forceFill([
            'last_latitude' => round($latitude, 7),
            'last_longitude' => round($longitude, 7),
            'last_position_at' => now(),
        ])->save();
    }

    /**
     * Persist the delivery photo and the signature (data URL) of a completed destination.
     *
     * @param  array{photo?: UploadedFile|null, signature?: string|null}  $proof
     * @return array{photo?: string, signature?: string}
     */
    protected function storeProof(Destination $destination, array $proof): array
    {
        $paths = [];

        if (($photo = $proof['photo'] ?? null) !== null) {
            $paths['photo'] = $photo->store("pod/{$destination->id}", 'public');
        }

        $signature = (string) ($proof['signature'] ?? '');

        if (str_starts_with($signature, 'data:image/png;base64,')) {
            $binary = base64_decode(substr($signature, strlen('data:image/png;base64,')), true);

            if ($binary !== false && $binary !== '') {
                $paths['signature'] = "pod/{$destination->id}/firma.png";
                Storage::disk('public')->put($paths['signature'], $binary);
            }
        }

        return $paths;
    }

    /**
     * Re-sync the workday after a stop changed: bump the route version and close
     * the day (with km and fuel totals) once no destination is left pending.
     */
    protected function syncWorkday(Destination $destination): void
    {
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
    }
}
