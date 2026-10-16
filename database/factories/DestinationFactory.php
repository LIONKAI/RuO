<?php

namespace Database\Factories;

use App\Enums\DestinationStatus;
use App\Models\Destination;
use App\Models\Workday;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Destination>
 */
class DestinationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workday_id' => Workday::factory(),
            'address' => fake()->streetAddress().', Santa Cruz',
            'reference' => fake()->company(),
            'latitude' => fake()->randomFloat(7, -17.82, -17.76),
            'longitude' => fake()->randomFloat(7, -63.21, -63.15),
            'status' => DestinationStatus::Pending,
            'is_unplanned' => false,
        ];
    }

    /**
     * Indicate that the destination was already completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DestinationStatus::Completed,
            'completed_at' => now(),
        ]);
    }
}
