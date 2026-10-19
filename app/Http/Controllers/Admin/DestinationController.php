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
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class DestinationController extends Controller
{
    /**
     * Open the destinations screen of the first vehicle.
     */
    public function start(Request $request): RedirectResponse
    {
        $vehicle = Vehicle::query()->orderBy('name')->first();

        if ($vehicle === null) {
            return redirect()->route('admin.vehicles.index')->with('error', 'Registra primero un vehículo.');
        }

        return redirect()->route('admin.destinations.index', [
            'vehicle' => $vehicle,
            'fecha' => $request->input('fecha'),
        ]);
    }

    /**
     * Show the form to load the destinations of a vehicle's workday.
     * Defaults to today; ?fecha=YYYY-MM-DD plans another date.
     */
    public function index(Request $request, Vehicle $vehicle): View
    {
        $date = $this->date($request);
        $vehicle->load('driver');
        $workday = $vehicle->workdayFor($date)->setRelation('vehicle', $vehicle)->load('destinations');

        return view('admin.destinations', [
            'vehicle' => $vehicle,
            'vehicles' => Vehicle::query()->orderBy('name')->get(['id', 'name', 'plate']),
            'workday' => $workday,
            'date' => $date,
            'route' => (new WorkdayResource($workday))->resolve(),
        ]);
    }

    /**
     * Add a planned destination to the vehicle's workday of the requested date.
     */
    public function store(StoreDestinationRequest $request, Vehicle $vehicle, WorkdayManager $manager): RedirectResponse
    {
        $date = $this->date($request);
        $workday = $vehicle->workdayFor($date);

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

        return redirect()->route('admin.destinations.index', ['vehicle' => $vehicle, 'fecha' => $date->toDateString()])
            ->with('status', "Destino «{$destination->reference}» agregado.");
    }

    /**
     * Remove a planned destination before the route is generated.
     */
    public function destroy(Request $request, Destination $destination): RedirectResponse
    {
        $this->authorize('delete', $destination);

        $vehicle = $destination->workday->vehicle;
        $destination->delete();

        return redirect()->route('admin.destinations.index', ['vehicle' => $vehicle, 'fecha' => $request->input('fecha')])
            ->with('status', 'Destino eliminado.');
    }

    /**
     * The workday date requested in ?fecha=YYYY-MM-DD, today by default.
     */
    protected function date(Request $request): Carbon
    {
        try {
            return Carbon::createFromFormat('Y-m-d', (string) $request->input('fecha', today()->toDateString()))->startOfDay();
        } catch (\Throwable) {
            return today();
        }
    }
}
