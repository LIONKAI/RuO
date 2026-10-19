<?php

use App\Models\Destination;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
});

test('the admin loads the four test destinations for vehicle 1', function () {
    fakeNominatim();

    $addresses = [
        ['Av. Cañoto 450, Santa Cruz', 'Ferretería El Constructor'],
        ['Calle Murillo 120, Santa Cruz', 'Distribuidora Norte'],
        ['Av. Busch 890, Santa Cruz', 'Almacén Central'],
        ['Calle Arenales 300, Santa Cruz', 'Taller Mecánico Sur'],
    ];

    foreach ($addresses as [$address, $reference]) {
        $this->actingAs($this->admin)
            ->post(route('admin.destinations.store', $this->vehicle), ['address' => $address, 'reference' => $reference])
            ->assertRedirect(route('admin.destinations.index', ['vehicle' => $this->vehicle, 'fecha' => today()->toDateString()]))
            ->assertSessionHasNoErrors();
    }

    $workday = $this->vehicle->todayWorkday()->first();

    expect($workday->destinations)->toHaveCount(4)
        ->and($workday->isDraft())->toBeTrue()
        ->and($workday->destinations->pluck('reference')->all())->toBe(array_column($addresses, 1));

    $this->actingAs($this->admin)
        ->get(route('admin.destinations.index', $this->vehicle))
        ->assertOk()
        ->assertSeeInOrder(['Ferretería El Constructor', 'Distribuidora Norte', 'Almacén Central', 'Taller Mecánico Sur'])
        ->assertSee('Generar ruta optimizada');
});

test('coordinates picked on the map are used without geocoding', function () {
    Http::fake();

    $this->actingAs($this->admin)->post(route('admin.destinations.store', $this->vehicle), [
        'address' => 'Calle sin número',
        'reference' => 'Cliente',
        'latitude' => -17.79,
        'longitude' => -63.19,
    ])->assertSessionHasNoErrors();

    Http::assertNothingSent();
    expect(Destination::first())->latitude->toBe(-17.79)->longitude->toBe(-63.19);
});

test('an address that cannot be found asks to mark it on the map', function () {
    fakeNominatim(found: false);

    $this->actingAs($this->admin)
        ->post(route('admin.destinations.store', $this->vehicle), ['address' => 'Dirección inexistente', 'reference' => 'X'])
        ->assertSessionHasErrors(['address' => 'No encontramos esa dirección. Márcala haciendo clic en el mapa y vuelve a guardar.']);

    expect(Destination::count())->toBe(0);
});

test('address and reference are required', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.destinations.store', $this->vehicle), [])
        ->assertSessionHasErrors(['address', 'reference']);
});

test('the admin can remove a destination before the route is generated', function () {
    $destination = Destination::factory()->for($this->vehicle->workdayForToday())->create();

    $this->actingAs($this->admin)
        ->delete(route('admin.destinations.destroy', $destination))
        ->assertRedirect(route('admin.destinations.index', $this->vehicle));

    expect(Destination::count())->toBe(0);
});

test('the geocode endpoint returns coordinates for the map', function () {
    fakeNominatim();

    $this->actingAs($this->admin)
        ->getJson(route('admin.geocode', ['address' => 'Av. Cañoto 450']))
        ->assertOk()
        ->assertJson(['latitude' => -17.78, 'longitude' => -63.18]);
});
