<?php

namespace App\Http\Resources;

use App\Models\Workday;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A workday with its route, as consumed by the live screens.
 *
 * @mixin Workday
 */
class WorkdayResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $completed = $this->completedCount();
        $total = $this->destinations->count();
        $drivenKm = $this->drivenKm();
        $routeKm = $this->routeKm();
        $active = $this->activeDestination();

        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'route_version' => $this->route_version,
            'signature' => implode('-', [$this->route_version, $completed, $total, $this->status->value]),
            'route_updated_at' => $this->route_updated_at?->toIso8601String(),
            'completed' => $completed,
            'total' => $total,
            'remaining' => $total - $completed,
            'driven_km' => $drivenKm,
            'route_km' => $routeKm,
            'driven_fuel' => $this->fuelForKm($drivenKm),
            'route_fuel' => $this->fuelForKm($routeKm),
            'total_km' => $this->total_km !== null ? (float) $this->total_km : null,
            'estimated_fuel_liters' => $this->estimated_fuel_liters !== null ? (float) $this->estimated_fuel_liters : null,
            'active_id' => $active?->id,
            'vehicle' => [
                'id' => $this->vehicle->id,
                'name' => $this->vehicle->name,
                'plate' => $this->vehicle->plate,
                'fuel_liters_per_km' => (float) $this->vehicle->fuel_liters_per_km,
                'driver' => $this->vehicle->driver?->name,
            ],
            'destinations' => DestinationResource::collection($this->destinations),
        ];
    }
}
