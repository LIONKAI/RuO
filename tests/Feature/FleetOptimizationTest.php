<?php

use App\Enums\WorkdayStatus;
use App\Models\Destination;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->vehicle1 = Vehicle::firstWhere('plate', 'ABC-123');
    $this->vehicle2 = Vehicle::firstWhere('plate', 'XYZ-456');
});

/**
 * Pool deliveries clustered geographically: three near the depot of
 * vehicle 1 (city center) and three near the depot of vehicle 2 (south).
 */
function poolWithTwoClusters(): void
{
    foreach ([
        ['Av. Cañoto 450', 'Centro 1', -17.7830, -63.1840],
        ['Calle Murillo 120', 'Centro 2', -17.7820, -63.1800],
        ['Calle Arenales 300', 'Centro 3', -17.7845, -63.1810],
        ['Av. Santos Dumont 100', 'Sur 1', -17.8210, -63.1760],
        ['Av. Santos Dumont 400', 'Sur 2', -17.8190, -63.1735],
        ['Av. Santos Dumont 700', 'Sur 3', -17.8225, -63.1780],
    ] as [$address, $reference, $latitude, $longitude]) {
        Destination::query()->create(compact('address', 'reference', 'latitude', 'longitude'));
    }
}

test('the pool is split between the fleet and each route is optimized', function () {
    poolWithTwoClusters();
    fakeOsrmTrip();

    $this->actingAs($this->admin)
        ->post(route('admin.pool.distribute'), ['fecha' => today()->toDateString()])
        ->assertRedirect(route('admin.dashboard'))
        ->assertSessionHas('status');

    expect(Destination::query()->inPool(today()->toDateString())->count())->toBe(0);

    $workday1 = $this->vehicle1->todayWorkday()->first();
    $workday2 = $this->vehicle2->todayWorkday()->first();

    expect($workday1->status)->toBe(WorkdayStatus::InProgress)
        ->and($workday2->status)->toBe(WorkdayStatus::InProgress)
        ->and($workday1->destinations()->count() + $workday2->destinations()->count())->toBe(6);

    // Each workday got the cluster nearest to its depot.
    expect($workday1->destinations->pluck('reference')->sort()->values()->all())->toBe(['Centro 1', 'Centro 2', 'Centro 3'])
        ->and($workday2->destinations->pluck('reference')->sort()->values()->all())->toBe(['Sur 1', 'Sur 2', 'Sur 3'])
        ->and($workday1->destinations->whereNotNull('position')->count())->toBe(3);
});

test('distributing with only one vehicle assigns the whole pool to it', function () {
    poolWithTwoClusters();
    fakeOsrmTrip();

    $this->actingAs($this->admin)
        ->post(route('admin.pool.distribute'), [
            'fecha' => today()->toDateString(),
            'vehicles' => [$this->vehicle1->id],
        ]);

    expect($this->vehicle1->todayWorkday()->first()->destinations()->count())->toBe(6)
        ->and($this->vehicle2->todayWorkday()->first())->toBeNull();
});

test('distributing an empty pool shows an error and creates no workday', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.pool.distribute'), ['fecha' => today()->toDateString()])
        ->assertRedirect(route('admin.pool.index', ['fecha' => today()->toDateString()]))
        ->assertSessionHas('error');

    expect($this->vehicle1->todayWorkday()->first())->toBeNull();
});

test('the admin adds a delivery to the pool with its coordinates', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.pool.store'), [
            'fecha' => today()->toDateString(),
            'address' => 'Av. Cañoto 450',
            'reference' => 'Ferretería El Constructor',
            'phone' => '70012345',
            'latitude' => -17.779,
            'longitude' => -63.189,
        ])
        ->assertRedirect(route('admin.pool.index', ['fecha' => today()->toDateString()]))
        ->assertSessionHasNoErrors();

    $destination = Destination::sole();

    expect($destination->isPool())->toBeTrue()
        ->and($destination->service_date->toDateString())->toBe(today()->toDateString())
        ->and($destination->phone)->toBe('70012345')
        ->and($destination->public_token)->not->toBeNull();
});

test('bulk import geocodes one delivery per line', function () {
    fakeNominatim();

    $this->actingAs($this->admin)
        ->post(route('admin.pool.import'), [
            'fecha' => today()->toDateString(),
            'lines' => "Av. Cañoto 450 | Ferretería El Constructor | 70012345\nCalle Murillo 120\n\n",
        ])
        ->assertRedirect(route('admin.pool.index', ['fecha' => today()->toDateString()]))
        ->assertSessionHasNoErrors();

    expect(Destination::query()->inPool(today()->toDateString())->count())->toBe(2)
        ->and(Destination::first()->reference)->toBe('Ferretería El Constructor');
});

test('a delivery still in the pool can be removed', function () {
    $destination = Destination::query()->create([
        'address' => 'Av. Cañoto 450',
        'reference' => 'X',
        'latitude' => -17.78,
        'longitude' => -63.18,
        'service_date' => today(),
    ]);

    $this->actingAs($this->admin)
        ->delete(route('admin.pool.destroy', $destination))
        ->assertSessionHasNoErrors();

    expect(Destination::count())->toBe(0);
});
