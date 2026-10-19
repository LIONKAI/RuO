<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
});

test('the admin registers a vehicle with its depot', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.vehicles.store'), [
            'name' => 'Camioneta 3',
            'plate' => 'QRS-789',
            'fuel_liters_per_km' => 0.12,
            'depot_address' => 'Zona Norte, km 5',
            'depot_latitude' => -17.75,
            'depot_longitude' => -63.20,
        ])
        ->assertRedirect(route('admin.vehicles.index'))
        ->assertSessionHasNoErrors();

    $vehicle = Vehicle::firstWhere('plate', 'QRS-789');

    expect($vehicle->hasDepot())->toBeTrue()
        ->and($vehicle->depot_latitude)->toBe(-17.75);
});

test('a vehicle cannot reuse an existing plate', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.vehicles.store'), [
            'name' => 'Duplicado',
            'plate' => 'ABC-123',
            'fuel_liters_per_km' => 0.1,
        ])
        ->assertSessionHasErrors('plate');
});

test('the admin edits a vehicle and assigns a driver', function () {
    $driver = User::factory()->driver()->create();

    $this->actingAs($this->admin)
        ->put(route('admin.vehicles.update', $this->vehicle), [
            'name' => 'Vehículo 1',
            'plate' => 'ABC-123',
            'fuel_liters_per_km' => 0.09,
            'driver_id' => $driver->id,
        ])
        ->assertSessionHasNoErrors();

    expect($this->vehicle->fresh()->driver_id)->toBe($driver->id)
        ->and((float) $this->vehicle->fresh()->fuel_liters_per_km)->toBe(0.09);
});

test('a vehicle with workdays cannot be deleted', function () {
    workdayWithTestDestinations($this->vehicle);

    $this->actingAs($this->admin)
        ->delete(route('admin.vehicles.destroy', $this->vehicle))
        ->assertSessionHas('error');

    expect(Vehicle::find($this->vehicle->id))->not->toBeNull();
});

test('a vehicle without workdays can be deleted', function () {
    $vehicle = Vehicle::factory()->create();

    $this->actingAs($this->admin)
        ->delete(route('admin.vehicles.destroy', $vehicle))
        ->assertSessionHas('status');

    expect(Vehicle::find($vehicle->id))->toBeNull();
});

test('the admin manages driver accounts', function () {
    // Create
    $this->actingAs($this->admin)
        ->post(route('admin.drivers.store'), [
            'name' => 'Carlos Roca',
            'email' => 'carlos@ruo.com',
            'password' => 'secreto123',
        ])
        ->assertRedirect(route('admin.drivers.index'))
        ->assertSessionHasNoErrors();

    $driver = User::firstWhere('email', 'carlos@ruo.com');
    expect($driver->role)->toBe(UserRole::Driver);

    // Update without touching the password
    $hash = $driver->password;
    $this->actingAs($this->admin)
        ->put(route('admin.drivers.update', $driver), [
            'name' => 'Carlos Roca Rojas',
            'email' => 'carlos@ruo.com',
        ])
        ->assertSessionHasNoErrors();

    expect($driver->fresh()->name)->toBe('Carlos Roca Rojas')
        ->and($driver->fresh()->password)->toBe($hash);

    // Delete: the vehicle is unassigned automatically
    $this->vehicle->update(['driver_id' => $driver->id]);
    $this->actingAs($this->admin)->delete(route('admin.drivers.destroy', $driver));

    expect(User::find($driver->id))->toBeNull()
        ->and($this->vehicle->fresh()->driver_id)->toBeNull();
});

test('drivers cannot open the management screens', function () {
    $driver = User::firstWhere('email', 'chofer1@ruo.com');

    $this->actingAs($driver)->get(route('admin.vehicles.index'))->assertRedirect();
    $this->actingAs($driver)->get(route('admin.pool.index'))->assertRedirect();
});
