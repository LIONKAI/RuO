<?php

use App\Enums\WorkdayStatus;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->driver = User::firstWhere('email', 'chofer1@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
    $this->workday = workdayWithTestDestinations($this->vehicle);

    // Legs anchored at the depot of 2, 3, 4 and 10 km: the route totals 19 km.
    fakeOsrmTrip(legMeters: [2000, 3000, 4000, 10000]);
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));
});

test('completing every destination closes the day with km and estimated fuel', function () {
    $destinations = $this->workday->destinations()->get();

    foreach ($destinations as $index => $destination) {
        $response = $this->actingAs($this->driver)
            ->postJson(route('driver.destinations.complete', $destination))
            ->assertOk();
    }

    $response->assertJson(['finished' => true, 'redirect' => route('driver.summary')]);

    $workday = $this->workday->fresh();

    expect($workday->status)->toBe(WorkdayStatus::Completed)
        ->and((float) $workday->total_km)->toBe(19.0)
        ->and((float) $workday->estimated_fuel_liters)->toBe(1.52);

    $this->actingAs($this->driver)
        ->get(route('driver.summary'))
        ->assertOk()
        ->assertSee('Jornada completada')
        ->assertSee('19.0')
        ->assertSee('1.52');

    $this->actingAs($this->admin)
        ->get(route('admin.summary'))
        ->assertOk()
        ->assertSee('Vehículo 1')
        ->assertSee('19.0 km')
        ->assertSee('1.52 L');

    $card = collect($this->actingAs($this->admin)->getJson(route('admin.state'))->json('vehicles'))->firstWhere('plate', 'ABC-123');
    expect($card['status'])->toBe('completed')->and($card['completed'])->toBe(4);
});

test('the summary screen is not available while the route is running', function () {
    $this->actingAs($this->driver)->get(route('driver.summary'))->assertRedirect(route('driver.route'));
});
