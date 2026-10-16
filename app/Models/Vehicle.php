<?php

namespace App\Models;

use Database\Factories\VehicleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['name', 'plate', 'fuel_liters_per_km', 'driver_id'])]
class Vehicle extends Model
{
    /** @use HasFactory<VehicleFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fuel_liters_per_km' => 'decimal:3',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * @return HasMany<Workday, $this>
     */
    public function workdays(): HasMany
    {
        return $this->hasMany(Workday::class);
    }

    /**
     * Today's workday for this vehicle, if one exists.
     *
     * @return HasOne<Workday, $this>
     */
    public function todayWorkday(): HasOne
    {
        return $this->hasOne(Workday::class)->whereDate('date', today());
    }

    /**
     * Get today's workday, creating an empty one when it does not exist yet.
     */
    public function workdayForToday(): Workday
    {
        return $this->todayWorkday()->first()
            ?? $this->workdays()->create(['date' => today()]);
    }
}
