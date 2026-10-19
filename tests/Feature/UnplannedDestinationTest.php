<?php

use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->driver = User::firstWhere('email', 'chofer1@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
    $this->workday = workdayWithTestDestinations($this->vehicle);
});

test('an unplanned destination recalculates the route from the last completed stop', function () {
    // Initial route anchored at the depot keeps the loading order.
    fakeOsrmTrip(legMeters: [1000, 1000, 1000, 5000]);
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));
    $first = $this->workday->destinations()->first();
    $this->actingAs($this->driver)->postJson(route('driver.destinations.complete', $first))->assertOk();
    $versionBefore = $this->workday->fresh()->route_version;

    // Recalculation: anchor (completed stop) first, then the 3 pending ones and the new one.
    // The service suggests visiting the new destination (input 4) right after the anchor.
    Http::swap(new Factory);
    fakeNominatim();
    fakeOsrmTrip(tripOrder: [0, 4, 1, 2, 3]);

    $this->actingAs($this->admin)
        ->post(route('admin.unplanned.store', $this->vehicle), [
            'address' => 'Av. Germán Busch 1200, Santa Cruz',
            'reference' => 'Cliente Nuevo',
        ])
        ->assertRedirect(route('admin.dashboard'))
        ->assertSessionHas('status');

    Http::assertSent(function (Request $request) use ($first) {
        return str_contains($request->url(), '/trip/v1/driving/')
            && $request['roundtrip'] === 'false'
            && $request['source'] === 'first'
            && str_contains(urldecode($request->url()), sprintf('%.6F,%.6F;', $first->longitude, $first->latitude));
    });

    $state = $this->actingAs($this->driver)->getJson(route('driver.state'))->assertOk();

    expect($state->json('route.total'))->toBe(5)
        ->and($state->json('route.completed'))->toBe(1)
        ->and($state->json('route.route_version'))->toBeGreaterThan($versionBefore)
        ->and(collect($state->json('route.destinations'))->pluck('reference')->all())->toBe([
            'Ferretería El Constructor', 'Cliente Nuevo', 'Distribuidora Norte', 'Almacén Central', 'Taller Mecánico Sur',
        ])
        ->and($state->json('route.destinations.1.is_unplanned'))->toBeTrue()
        ->and($state->json('route.destinations.0.status'))->toBe('completed');
});

test('unplanned destinations are only allowed once the route was generated', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.unplanned.create', $this->vehicle))
        ->assertRedirect(route('admin.destinations.index', $this->vehicle));
});

test('if the recalculation fails the unplanned destination is not saved', function () {
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    Http::swap(new Factory);
    Http::fake(['router.project-osrm.org/*' => Http::response([], 500)]);

    $this->actingAs($this->admin)
        ->from(route('admin.unplanned.create', $this->vehicle))
        ->post(route('admin.unplanned.store', $this->vehicle), [
            'address' => 'Av. Germán Busch 1200', 'reference' => 'Cliente Nuevo', 'latitude' => -17.76, 'longitude' => -63.17,
        ])
        ->assertSessionHasErrors('address');

    expect($this->workday->destinations()->count())->toBe(4);
});

test('the unplanned destination form shows the current route', function () {
    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));

    $this->actingAs($this->admin)
        ->get(route('admin.unplanned.create', $this->vehicle))
        ->assertOk()
        ->assertSee('Agregar y recalcular ruta')
        ->assertSee('Ferretería El Constructor');
});
