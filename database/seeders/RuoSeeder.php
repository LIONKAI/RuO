<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

/**
 * Test data from the RuO MVP plan (section 15). Safe to run more than once.
 */
class RuoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@ruo.com'],
            ['name' => 'Administrador RuO', 'password' => 'admin123', 'role' => UserRole::Admin],
        );

        $juan = User::query()->updateOrCreate(
            ['email' => 'chofer1@ruo.com'],
            ['name' => 'Juan Quispe', 'password' => 'chofer123', 'role' => UserRole::Driver],
        );

        $pedro = User::query()->updateOrCreate(
            ['email' => 'chofer2@ruo.com'],
            ['name' => 'Pedro Mamani', 'password' => 'chofer123', 'role' => UserRole::Driver],
        );

        Vehicle::query()->updateOrCreate(
            ['plate' => 'ABC-123'],
            [
                'name' => 'Vehículo 1',
                'fuel_liters_per_km' => 0.08,
                'driver_id' => $juan->id,
                'depot_address' => 'Plaza 24 de Septiembre, Santa Cruz',
                'depot_latitude' => -17.7834,
                'depot_longitude' => -63.1821,
            ],
        );

        Vehicle::query()->updateOrCreate(
            ['plate' => 'XYZ-456'],
            [
                'name' => 'Vehículo 2',
                'fuel_liters_per_km' => 0.10,
                'driver_id' => $pedro->id,
                'depot_address' => 'Av. Santos Dumont 4to Anillo, Santa Cruz',
                'depot_latitude' => -17.8200,
                'depot_longitude' => -63.1750,
            ],
        );
    }
}
