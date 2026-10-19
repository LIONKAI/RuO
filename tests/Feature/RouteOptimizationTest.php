<?php

use App\Enums\WorkdayStatus;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->driver = User::firstWhere('email', 'chofer1@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
});

test('generating the route orders destinations as the optimization service suggests', function () {
    $workday = workdayWithTestDestinations($this->vehicle);
    // Trip anchored at the depot (input 0) suggested by the service:
    // Depot → Arenales → Cañoto → Murillo → Busch.
    fakeOsrmTrip(tripOrder: [0, 4, 1, 2, 3], legMeters: [1200, 800, 900, 3000]);

    $this->actingAs($this->admin)
        ->post(route('admin.route.store', $this->vehicle))
        ->assertRedirect(route('admin.destinations.index', ['vehicle' => $this->vehicle, 'fecha' => today()->toDateString()]))
        ->assertSessionHas('status');

    $workday->refresh()->load('destinations');

    expect($workday->status)->toBe(WorkdayStatus::InProgress)
        ->and($workday->route_version)->toBe(1)
        ->and($workday->destinations->pluck('reference')->all())->toBe([
            'Taller Mecánico Sur', 'Ferretería El Constructor', 'Distribuidora Norte', 'Almacén Central',
        ])
        ->and($workday->destinations->pluck('leg_distance_meters')->all())->toBe([1200, 800, 900, 3000])
        ->and($workday->routeKm())->toBe(5.9);

    Http::assertSent(fn (Request $request) => str_contains($request->url(), '/trip/v1/driving/')
        && $request['roundtrip'] === 'false' && $request['source'] === 'first'
        && str_contains(urldecode($request->url()), sprintf('%.6F,%.6F;', $this->vehicle->depot_longitude, $this->vehicle->depot_latitude)));
});

test('the driver sees the optimized route with map data and ordered list', function () {
    workdayWithTestDestinations($this->vehicle);
    fakeOsrmTrip(tripOrder: [0, 2, 1, 3, 4], legMeters: [1000, 1000, 1000, 5000]);
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    $this->actingAs($this->driver)
        ->getJson(route('driver.state'))
        ->assertOk()
        ->assertJsonPath('status', 'in_progress')
        ->assertJsonPath('route.total', 4)
        ->assertJsonPath('route.completed', 0)
        ->assertJsonPath('route.destinations.0.reference', 'Distribuidora Norte')
        ->assertJsonPath('route.destinations.1.reference', 'Ferretería El Constructor')
        ->assertJsonPath('route.destinations.1.steps.0.text', 'Sal por Av. Prueba')
        ->assertJsonCount(2, 'route.destinations.1.geometry')
        ->assertJsonPath('route.active_id', $this->vehicle->todayWorkday->destinations->first()->id);

    $this->actingAs($this->driver)->get(route('driver.route'))->assertOk()->assertSee('Distribuidora Norte');
    $this->actingAs($this->driver)->get(route('driver.active'))->assertOk()->assertSee('Indicaciones para llegar');
});

test('a workday cannot start without destinations', function () {
    Http::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.route.store', $this->vehicle))
        ->assertSessionHas('error', 'No se puede iniciar la jornada sin al menos un destino cargado.');

    expect($this->vehicle->todayWorkday->isDraft())->toBeTrue();
    Http::assertNothingSent();
});

test('a failure of the routing service keeps the workday as draft', function () {
    workdayWithTestDestinations($this->vehicle);
    Http::fake(['router.project-osrm.org/*' => Http::response(['code' => 'NoTrips'], 400)]);

    $this->actingAs($this->admin)
        ->post(route('admin.route.store', $this->vehicle))
        ->assertSessionHas('error');

    expect($this->vehicle->todayWorkday->isDraft())->toBeTrue()
        ->and($this->vehicle->todayWorkday->destinations->whereNotNull('position'))->toBeEmpty();
});

test('the driver waits for the route while it is not generated', function () {
    workdayWithTestDestinations($this->vehicle);

    $this->actingAs($this->driver)
        ->getJson(route('driver.state'))
        ->assertOk()
        ->assertJsonPath('status', 'no_route')
        ->assertJsonPath('route', null);
});
