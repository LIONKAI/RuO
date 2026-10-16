<?php

namespace Database\Factories;

use App\Enums\WorkdayStatus;
use App\Models\Vehicle;
use App\Models\Workday;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Workday>
 */
class WorkdayFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'vehicle_id' => Vehicle::factory(),
            'date' => today()->toDateString(),
            'status' => WorkdayStatus::Draft,
        ];
    }

    /**
     * Indicate that the route was already generated.
     */
    public function inProgress(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => WorkdayStatus::InProgress,
            'route_version' => 1,
            'route_updated_at' => now(),
        ]);
    }
}
