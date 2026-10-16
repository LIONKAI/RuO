<?php

namespace App\Models;

use App\Enums\DestinationStatus;
use App\Enums\WorkdayStatus;
use Database\Factories\WorkdayFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['vehicle_id', 'date', 'status', 'route_version', 'route_updated_at', 'total_km', 'estimated_fuel_liters', 'completed_at'])]
class Workday extends Model
{
    /** @use HasFactory<WorkdayFactory> */
    use HasFactory;

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'draft',
        'route_version' => 0,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'status' => WorkdayStatus::class,
            'route_version' => 'integer',
            'route_updated_at' => 'datetime',
            'total_km' => 'decimal:2',
            'estimated_fuel_liters' => 'decimal:2',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Destinations ordered by their optimized position (unordered ones last).
     *
     * @return HasMany<Destination, $this>
     */
    public function destinations(): HasMany
    {
        return $this->hasMany(Destination::class)
            ->orderByRaw('position is null')
            ->orderBy('position')
            ->orderBy('id');
    }

    public function isDraft(): bool
    {
        return $this->status === WorkdayStatus::Draft;
    }

    public function isInProgress(): bool
    {
        return $this->status === WorkdayStatus::InProgress;
    }

    public function isCompleted(): bool
    {
        return $this->status === WorkdayStatus::Completed;
    }

    /**
     * The next pending destination the driver must visit.
     */
    public function activeDestination(): ?Destination
    {
        return $this->destinations->firstWhere('status', DestinationStatus::Pending);
    }

    public function completedCount(): int
    {
        return $this->destinations->where('status', DestinationStatus::Completed)->count();
    }

    /**
     * Kilometers of the whole optimized route (completed and pending legs).
     */
    public function routeKm(): float
    {
        return round($this->destinations->sum('leg_distance_meters') / 1000, 2);
    }

    /**
     * Kilometers already driven (legs of completed destinations).
     */
    public function drivenKm(): float
    {
        $meters = $this->destinations
            ->where('status', DestinationStatus::Completed)
            ->sum('leg_distance_meters');

        return round($meters / 1000, 2);
    }

    /**
     * Estimated fuel for the given kilometers using this vehicle's consumption.
     */
    public function fuelForKm(float $km): float
    {
        return round($km * (float) $this->vehicle->fuel_liters_per_km, 2);
    }
}
