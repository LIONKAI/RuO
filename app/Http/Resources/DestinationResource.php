<?php

namespace App\Http\Resources;

use App\Models\Destination;
use App\Services\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

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
            'phone' => $this->phone,
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
            'failure_reason' => $this->failure_reason,
            'tracking_url' => $this->trackingUrl(),
            'whatsapp_url' => app(WhatsApp::class)->trackingLink($this->resource),
            'recipient_name' => $this->recipient_name,
            'pod_note' => $this->pod_note,
            'pod_photo_url' => $this->pod_photo_path ? Storage::disk('public')->url($this->pod_photo_path) : null,
            'pod_signature_url' => $this->pod_signature_path ? Storage::disk('public')->url($this->pod_signature_path) : null,
        ];
    }
}
