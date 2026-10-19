<?php

namespace App\Models;

use App\Enums\DestinationStatus;
use Database\Factories\DestinationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable([
    'workday_id', 'service_date', 'address', 'reference', 'phone', 'latitude', 'longitude',
    'status', 'is_unplanned', 'public_token', 'failure_reason', 'recipient_name', 'pod_note',
    'pod_photo_path', 'pod_signature_path', 'delivered_latitude', 'delivered_longitude',
    'position', 'leg_distance_meters', 'leg_duration_seconds', 'leg_geometry', 'leg_steps', 'completed_at',
])]
class Destination extends Model
{
    /** @use HasFactory<DestinationFactory> */
    use HasFactory;

    /**
     * Reasons a driver can give when a delivery could not be completed.
     *
     * @var array<string, string>
     */
    public const FAILURE_REASONS = [
        'ausente' => 'Cliente ausente',
        'direccion_incorrecta' => 'Dirección incorrecta',
        'rechazado' => 'Cliente rechazó la entrega',
        'fuera_de_zona' => 'Fuera de zona',
        'otro' => 'Otro motivo',
    ];

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'pending',
        'is_unplanned' => false,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service_date' => 'date',
            'latitude' => 'float',
            'longitude' => 'float',
            'status' => DestinationStatus::class,
            'is_unplanned' => 'boolean',
            'position' => 'integer',
            'leg_distance_meters' => 'integer',
            'leg_duration_seconds' => 'integer',
            'leg_geometry' => 'array',
            'leg_steps' => 'array',
            'completed_at' => 'datetime',
            'delivered_latitude' => 'float',
            'delivered_longitude' => 'float',
        ];
    }

    /**
     * Every destination gets a public tracking token; pool destinations keep the
     * date they must be served on until they are assigned to a workday.
     */
    protected static function booted(): void
    {
        static::creating(function (Destination $destination) {
            $destination->public_token ??= Str::random(40);

            if ($destination->service_date === null) {
                $destination->service_date = $destination->workday_id !== null
                    ? $destination->workday->date
                    : today();
            }
        });
    }

    /**
     * @return BelongsTo<Workday, $this>
     */
    public function workday(): BelongsTo
    {
        return $this->belongsTo(Workday::class);
    }

    /**
     * Unassigned deliveries of the pool waiting to be served on the given date.
     */
    #[Scope]
    protected function inPool(Builder $query, string $date): Builder
    {
        return $query->whereNull('workday_id')->whereDate('service_date', $date)->orderBy('id');
    }

    public function isPending(): bool
    {
        return $this->status === DestinationStatus::Pending;
    }

    public function isCompleted(): bool
    {
        return $this->status === DestinationStatus::Completed;
    }

    public function isFailed(): bool
    {
        return $this->status === DestinationStatus::Failed;
    }

    /**
     * Whether the destination still waits in the pool (no workday assigned).
     */
    public function isPool(): bool
    {
        return $this->workday_id === null;
    }

    /**
     * Public URL the customer opens to follow this delivery.
     */
    public function trackingUrl(): string
    {
        return route('tracking.show', $this->public_token);
    }
}
