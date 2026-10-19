<?php

use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->driver = User::firstWhere('email', 'chofer1@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
});

test('the driver shares the GPS position while the route is running', function () {
    workdayWithTestDestinations($this->vehicle);
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    $this->actingAs($this->driver)
        ->postJson(route('driver.position.store'), ['latitude' => -17.7815, 'longitude' => -63.184])
        ->assertOk()
        ->assertJson(['ok' => true]);

    $position = $this->vehicle->todayWorkday->fresh()->lastPosition();

    expect($position['latitude'])->toBe(-17.7815)
        ->and($position['longitude'])->toBe(-63.184)
        ->and($position['at'])->not->toBeNull();
});

test('the position is rejected when the route has not started', function () {
    workdayWithTestDestinations($this->vehicle);

    $this->actingAs($this->driver)
        ->postJson(route('driver.position.store'), ['latitude' => -17.78, 'longitude' => -63.18])
        ->assertStatus(422);
});

test('the position payload is validated', function () {
    workdayWithTestDestinations($this->vehicle);
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    $this->actingAs($this->driver)
        ->postJson(route('driver.position.store'), ['latitude' => 999])
        ->assertJsonValidationErrors(['latitude', 'longitude']);
});
