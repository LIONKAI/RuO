<?php

use App\Models\Destination;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
});

test('the public tracking page loads for a delivery still in the pool', function () {
    $destination = Destination::query()->create([
        'address' => 'Av. Cañoto 450',
        'reference' => 'Ferretería El Constructor',
        'latitude' => -17.779,
        'longitude' => -63.189,
        'service_date' => today(),
    ]);

    $this->get(route('tracking.show', $destination->public_token))
        ->assertOk()
        ->assertSee('Sigue tu entrega')
        ->assertSee($destination->public_token);

    $this->getJson(route('tracking.state', $destination->public_token))
        ->assertOk()
        ->assertJsonPath('status', 'scheduled')
        ->assertJsonPath('reference', 'Ferretería El Constructor')
        ->assertJsonPath('vehicle', null);
});

test('the tracking state reports the queue position and ETA of a running delivery', function () {
    $workday = workdayWithTestDestinations($this->vehicle);
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    $workday->refresh();
    $first = $workday->destinations->first();
    $second = $workday->destinations->get(1);

    $state = $this->getJson(route('tracking.state', $second->public_token))->assertOk();

    expect($state->json('status'))->toBe('pending')
        ->and($state->json('queue_position'))->toBe(1)
        ->and($state->json('eta_minutes'))->toBeGreaterThan(0)
        ->and($state->json('vehicle.name'))->toBe('Vehículo 1')
        ->and(collect($state->json('legs'))->count())->toBe(2);

    // The live position of the vehicle is shared with the customer.
    $this->actingAs(User::firstWhere('email', 'chofer1@ruo.com'))
        ->postJson(route('driver.position.store'), ['latitude' => -17.78, 'longitude' => -63.185])
        ->assertOk();

    $this->getJson(route('tracking.state', $first->public_token))
        ->assertJsonPath('vehicle.position.latitude', -17.78)
        ->assertJsonPath('queue_position', 0);
});

test('the tracking state reflects a completed delivery', function () {
    $workday = workdayWithTestDestinations($this->vehicle);
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    $first = $workday->fresh()->destinations->first();

    $this->actingAs(User::firstWhere('email', 'chofer1@ruo.com'))
        ->postJson(route('driver.destinations.complete', $first));

    $this->getJson(route('tracking.state', $first->public_token))
        ->assertOk()
        ->assertJsonPath('status', 'completed')
        ->assertJsonPath('queue_position', null)
        ->assertJsonPath('eta_minutes', null);
});

test('an invalid tracking token returns 404', function () {
    $this->get(route('tracking.show', 'token-que-no-existe'))->assertNotFound();
    $this->getJson(route('tracking.state', 'token-que-no-existe'))->assertNotFound();
});
