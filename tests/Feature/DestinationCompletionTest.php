<?php

use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->driver = User::firstWhere('email', 'chofer1@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');

    $this->workday = workdayWithTestDestinations($this->vehicle);
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));
    $this->workday->refresh();
});

test('the driver completes the first destination and the admin sees 1 of 4', function () {
    $first = $this->workday->destinations->first();

    $this->actingAs($this->driver)
        ->postJson(route('driver.destinations.complete', $first))
        ->assertOk()
        ->assertJson(['finished' => false]);

    $this->actingAs($this->driver)
        ->getJson(route('driver.state'))
        ->assertJsonPath('route.destinations.0.status', 'completed')
        ->assertJsonPath('route.completed', 1)
        ->assertJsonPath('route.active_id', $this->workday->destinations[1]->id);

    $vehicleCard = collect($this->actingAs($this->admin)->getJson(route('admin.state'))->assertOk()->json('vehicles'))
        ->firstWhere('plate', 'ABC-123');

    expect($vehicleCard)
        ->completed->toBe(1)
        ->total->toBe(4)
        ->status->toBe('in_progress')
        ->and($vehicleCard['active']['reference'])->toBe($this->workday->destinations[1]->reference);
});

test('only the assigned driver can complete a destination', function () {
    $otherDriver = User::firstWhere('email', 'chofer2@ruo.com');

    $this->actingAs($otherDriver)
        ->postJson(route('driver.destinations.complete', $this->workday->destinations->first()))
        ->assertForbidden();

    expect($this->workday->fresh()->completedCount())->toBe(0);
});

test('destinations must be completed in route order', function () {
    $this->actingAs($this->driver)
        ->postJson(route('driver.destinations.complete', $this->workday->destinations[2]))
        ->assertForbidden()
        ->assertJson(['message' => 'Completa los destinos en el orden de la ruta.']);
});

test('a completed destination cannot be completed again', function () {
    $first = $this->workday->destinations->first();
    $this->actingAs($this->driver)->postJson(route('driver.destinations.complete', $first))->assertOk();

    $this->actingAs($this->driver)->postJson(route('driver.destinations.complete', $first))->assertForbidden();
});
