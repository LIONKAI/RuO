<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Vehículo '.fake()->unique()->numberBetween(1, 999),
            'plate' => strtoupper(fake()->unique()->bothify('???-###')),
            'fuel_liters_per_km' => 0.08,
            'driver_id' => User::factory()->driver(),
        ];
    }
}
