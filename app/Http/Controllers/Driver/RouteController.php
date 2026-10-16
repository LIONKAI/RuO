<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkdayResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class RouteController extends Controller
{
    /**
     * "Mi ruta del día": map and ordered list of destinations.
     */
    public function show(Request $request): View
    {
        return view('driver.route', ['initialState' => $this->payload($request)]);
    }

    /**
     * "Destino activo": directions to the next destination.
     */
    public function active(Request $request): View|RedirectResponse
    {
        $state = $this->payload($request);

        if ($state['status'] === 'completed') {
            return redirect()->route('driver.summary');
        }

        return view('driver.active', ['initialState' => $state]);
    }

    /**
     * Final summary of the driver's workday.
     */
    public function summary(Request $request): View|RedirectResponse
    {
        $state = $this->payload($request);

        if ($state['status'] !== 'completed') {
            return redirect()->route('driver.route');
        }

        return view('driver.summary', ['state' => $state]);
    }

    /**
     * Live route payload polled by the driver's screens.
     */
    public function state(Request $request): JsonResponse
    {
        return response()->json($this->payload($request));
    }

    /**
     * @return array<string, mixed>
     */
    protected function payload(Request $request): array
    {
        $vehicle = $request->user()->vehicle;

        if ($vehicle === null) {
            return ['status' => 'no_vehicle', 'signature' => 'no_vehicle', 'route' => null];
        }

        $workday = $vehicle->todayWorkday;

        if ($workday === null || $workday->isDraft()) {
            return [
                'status' => 'no_route',
                'signature' => 'no_route',
                'vehicle' => ['name' => $vehicle->name, 'plate' => $vehicle->plate],
                'route' => null,
            ];
        }

        $workday->setRelation('vehicle', $vehicle->setRelation('driver', $request->user()))->load('destinations');
        $route = (new WorkdayResource($workday))->resolve($request);

        return [
            'status' => $workday->status->value,
            'signature' => $route['signature'],
            'route' => $route,
        ];
    }
}
