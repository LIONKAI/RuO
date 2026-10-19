<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\Workday;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;

class DashboardController extends Controller
{
    /**
     * Show the live status of every vehicle.
     */
    public function index(): View
    {
        return view('admin.dashboard', ['initialState' => $this->state()->getData(true)]);
    }

    /**
     * Live status payload polled by the dashboard.
     */
    public function state(): JsonResponse
    {
        $vehicles = Vehicle::query()
            ->with(['driver', 'todayWorkday.destinations'])
            ->orderBy('name')
            ->get();

        $cards = $vehicles->map(function (Vehicle $vehicle) {
            $workday = $vehicle->todayWorkday?->setRelation('vehicle', $vehicle);

            return [
                'id' => $vehicle->id,
                'name' => $vehicle->name,
                'plate' => $vehicle->plate,
                'driver' => $vehicle->driver?->name ?? 'Sin chofer',
                'status' => $workday?->status->value ?? 'draft',
                'status_label' => $workday?->status->label() ?? 'Sin iniciar',
                'completed' => $workday?->completedCount() ?? 0,
                'failed' => $workday?->failedCount() ?? 0,
                'total' => $workday?->destinations->count() ?? 0,
                'driven_km' => $workday?->drivenKm() ?? 0,
                'route_km' => $workday?->routeKm() ?? 0,
                'driven_fuel' => $workday ? $workday->fuelForKm($workday->drivenKm()) : 0,
                'active' => $this->activeDestination($workday),
                'map' => $this->fleetMap($vehicle, $workday),
                'urls' => [
                    'destinations' => route('admin.destinations.index', $vehicle),
                    'unplanned' => route('admin.unplanned.create', $vehicle),
                ],
            ];
        });

        return response()->json([
            'stats' => [
                'active_vehicles' => $cards->where('status', 'in_progress')->count(),
                'total_vehicles' => $cards->count(),
                'completed_destinations' => $cards->sum('completed'),
                'total_destinations' => $cards->sum('total'),
                'driven_km' => round($cards->sum('driven_km'), 1),
                'driven_fuel' => round($cards->sum('driven_fuel'), 1),
            ],
            'vehicles' => $cards->values(),
            'updated_at' => now()->format('H:i:s'),
        ]);
    }

    /**
     * @return array{reference: string, address: string, is_unplanned: bool}|null
     */
    protected function activeDestination(?Workday $workday): ?array
    {
        if ($workday === null || ! $workday->isInProgress()) {
            return null;
        }

        $active = $workday->activeDestination();

        return $active ? [
            'reference' => $active->reference,
            'address' => $active->address,
            'is_unplanned' => $active->is_unplanned,
        ] : null;
    }

    /**
     * Map payload of a running route: depot, last driver position and stops
     * with the leg geometry that reaches each one.
     *
     * @return array<string, mixed>|null
     */
    protected function fleetMap(Vehicle $vehicle, ?Workday $workday): ?array
    {
        if ($workday === null || ! $workday->isInProgress()) {
            return $vehicle->hasDepot() ? ['depot' => $this->depot($vehicle), 'position' => null, 'destinations' => []] : null;
        }

        return [
            'depot' => $this->depot($vehicle),
            'position' => $workday->lastPosition(),
            'destinations' => $workday->destinations->map(fn ($destination) => [
                'id' => $destination->id,
                'position' => $destination->position,
                'reference' => $destination->reference,
                'status' => $destination->status->value,
                'is_unplanned' => $destination->is_unplanned,
                'latitude' => $destination->latitude,
                'longitude' => $destination->longitude,
                'geometry' => $destination->leg_geometry ?? [],
            ])->all(),
        ];
    }

    /**
     * @return array{latitude: float, longitude: float}|null
     */
    protected function depot(Vehicle $vehicle): ?array
    {
        return $vehicle->hasDepot()
            ? ['latitude' => $vehicle->depot_latitude, 'longitude' => $vehicle->depot_longitude]
            : null;
    }
}
