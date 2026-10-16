<?php

use App\Models\Vehicle;
use App\Models\Workday;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(fn () => $this->withoutVite())
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * Fake the OSRM trip service. By default the trip keeps the input order; pass
 * $tripOrder (input indexes in visiting order) to simulate a different optimization.
 * Every leg is 1 km long unless $legMeters is given.
 *
 * @param  list<int>|null  $tripOrder
 * @param  list<int>|null  $legMeters
 */
function fakeOsrmTrip(?array $tripOrder = null, ?array $legMeters = null): void
{
    Http::fake([
        'router.project-osrm.org/*' => function (Request $request) use ($tripOrder, $legMeters) {
            preg_match('#/trip/v1/driving/([^?]+)#', urldecode($request->url()), $matches);
            $coordinates = array_map(
                fn (string $pair) => array_map('floatval', explode(',', $pair)),
                explode(';', $matches[1]),
            );
            $count = count($coordinates);
            $order = $tripOrder ?? range(0, $count - 1);
            $roundTrip = ($request->data()['roundtrip'] ?? 'true') === 'true';
            $legCount = $roundTrip ? $count : $count - 1;

            $legs = [];
            for ($leg = 0; $leg < $legCount; $leg++) {
                $from = $coordinates[$order[$leg]];
                $to = $coordinates[$order[($leg + 1) % $count]];
                $distance = $legMeters[$leg] ?? 1000;
                $legs[] = [
                    'distance' => $distance,
                    'duration' => $distance / 10,
                    'steps' => [
                        ['name' => 'Av. Prueba', 'distance' => $distance, 'maneuver' => ['type' => 'depart'], 'geometry' => ['coordinates' => [$from, $to]]],
                        ['name' => '', 'distance' => 0, 'maneuver' => ['type' => 'arrive'], 'geometry' => ['coordinates' => [$to]]],
                    ],
                ];
            }

            $waypoints = [];
            foreach ($coordinates as $index => $coordinate) {
                $waypoints[$index] = ['waypoint_index' => array_search($index, $order, true), 'trips_index' => 0, 'location' => $coordinate];
            }

            return Http::response([
                'code' => 'Ok',
                'waypoints' => $waypoints,
                'trips' => [['legs' => $legs, 'distance' => array_sum(array_column($legs, 'distance'))]],
            ]);
        },
    ]);
}

/**
 * Fake Nominatim so every address resolves to a point in Santa Cruz.
 */
function fakeNominatim(bool $found = true): void
{
    Http::fake([
        'nominatim.openstreetmap.org/*' => Http::response(
            $found ? [['lat' => '-17.7800000', 'lon' => '-63.1800000', 'display_name' => 'Santa Cruz de la Sierra, Bolivia']] : [],
        ),
    ]);
}

/**
 * Today's draft workday of the given vehicle with the four test destinations of the MVP plan.
 */
function workdayWithTestDestinations(Vehicle $vehicle): Workday
{
    $workday = $vehicle->workdayForToday();

    foreach ([
        ['Av. Cañoto 450, Santa Cruz', 'Ferretería El Constructor', -17.7790, -63.1890],
        ['Calle Murillo 120, Santa Cruz', 'Distribuidora Norte', -17.7760, -63.1830],
        ['Av. Busch 890, Santa Cruz', 'Almacén Central', -17.7700, -63.1780],
        ['Calle Arenales 300, Santa Cruz', 'Taller Mecánico Sur', -17.7870, -63.1800],
    ] as [$address, $reference, $latitude, $longitude]) {
        $workday->destinations()->create(compact('address', 'reference', 'latitude', 'longitude'));
    }

    return $workday;
}
