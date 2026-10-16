<?php

namespace App\Http\Resources;

use App\Models\Destination;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Destination
 */
class DestinationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position,
            'reference' => $this->reference,
            'address' => $this->address,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_unplanned' => $this->is_unplanned,
            'leg_km' => round(($this->leg_distance_meters ?? 0) / 1000, 1),
            'leg_minutes' => (int) ceil(($this->leg_duration_seconds ?? 0) / 60),
            'geometry' => $this->leg_geometry ?? [],
            'steps' => $this->leg_steps ?? [],
            'completed_at' => $this->completed_at?->format('H:i'),
        ];
    }
}
