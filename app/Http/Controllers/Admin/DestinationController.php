<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDestinationRequest;
use App\Http\Resources\WorkdayResource;
use App\Models\Destination;
use App\Models\Vehicle;
use App\Services\RoutingServiceException;
use App\Services\WorkdayManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class DestinationController extends Controller
{
    /**
     * Open the destinations screen of the first vehicle.
     */
    public function start(): RedirectResponse
    {
        $vehicle = Vehicle::query()->orderBy('name')->first();

        if ($vehicle === null) {
            return redirect()->route('admin.dashboard')->with('error', 'Todavía no hay vehículos registrados.');
        }

        return redirect()->route('admin.destinations.index', $vehicle);
    }

    /**
     * Show the form to load today's destinations of a vehicle.
     */
    public function index(Vehicle $vehicle): View
    {
        $vehicle->load('driver');
        $workday = $vehicle->workdayForToday()->setRelation('vehicle', $vehicle)->load('destinations');

        return view('admin.destinations', [
            'vehicle' => $vehicle,
            'vehicles' => Vehicle::query()->orderBy('name')->get(['id', 'name', 'plate']),
            'workday' => $workday,
            'route' => (new WorkdayResource($workday))->resolve(),
        ]);
    }

    /**
     * Add a planned destination to today's workday of the vehicle.
     */
    public function store(StoreDestinationRequest $request, Vehicle $vehicle, WorkdayManager $manager): RedirectResponse
    {
        $workday = $vehicle->workdayForToday();

        if (! $workday->isDraft()) {
            return redirect()->route('admin.unplanned.create', $vehicle)
                ->with('error', 'La ruta ya fue generada. Agrega el nuevo punto como destino imprevisto.');
        }

        try {
            $data = $manager->resolveCoordinates($request->validated());
        } catch (RoutingServiceException $exception) {
            return back()->withInput()->withErrors(['address' => $exception->getMessage()]);
        }

        $destination = $manager->addPlanned($workday, $data);

        return redirect()->route('admin.destinations.index', $vehicle)
            ->with('status', "Destino «{$destination->reference}» agregado.");
    }

    /**
     * Remove a planned destination before the route is generated.
     */
    public function destroy(Destination $destination): RedirectResponse
    {
        $this->authorize('delete', $destination);

        $vehicle = $destination->workday->vehicle;
        $destination->delete();

        return redirect()->route('admin.destinations.index', $vehicle)
            ->with('status', 'Destino eliminado.');
    }
}
