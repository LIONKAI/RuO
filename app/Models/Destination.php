<?php

namespace App\Models;

use App\Enums\DestinationStatus;
use Database\Factories\DestinationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'workday_id', 'address', 'reference', 'latitude', 'longitude', 'status', 'is_unplanned',
    'position', 'leg_distance_meters', 'leg_duration_seconds', 'leg_geometry', 'leg_steps', 'completed_at',
])]
class Destination extends Model
{
    /** @use HasFactory<DestinationFactory> */
    use HasFactory;

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
        ];
    }

    /**
     * @return BelongsTo<Workday, $this>
     */
    public function workday(): BelongsTo
    {
        return $this->belongsTo(Workday::class);
    }

    public function isPending(): bool
    {
        return $this->status === DestinationStatus::Pending;
    }

    public function isCompleted(): bool
    {
        return $this->status === DestinationStatus::Completed;
    }
}
