<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDestinationRequest;
use App\Http\Resources\WorkdayResource;
use App\Models\Vehicle;
use App\Services\RoutingServiceException;
use App\Services\WorkdayManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class UnplannedDestinationController extends Controller
{
    /**
     * Show the form to add an unplanned destination to a running route.
     */
    public function create(Vehicle $vehicle): View|RedirectResponse
    {
        $vehicle->load('driver');
        $workday = $vehicle->todayWorkday;

        if ($workday === null || $workday->isDraft()) {
            return redirect()->route('admin.destinations.index', $vehicle)
                ->with('error', 'Primero genera la ruta del día. Mientras tanto, agrega los destinos normalmente.');
        }

        $workday->setRelation('vehicle', $vehicle)->load('destinations');

        return view('admin.unplanned', [
            'vehicle' => $vehicle,
            'workday' => $workday,
            'route' => (new WorkdayResource($workday))->resolve(),
        ]);
    }

    /**
     * Store the unplanned destination and recalculate the route right away.
     */
    public function store(StoreDestinationRequest $request, Vehicle $vehicle, WorkdayManager $manager): RedirectResponse
    {
        $workday = $vehicle->todayWorkday;

        if ($workday === null || $workday->isDraft()) {
            return redirect()->route('admin.destinations.index', $vehicle)
                ->with('error', 'Primero genera la ruta del día.');
        }

        try {
            $destination = $manager->addUnplanned($workday, $manager->resolveCoordinates($request->validated()));
        } catch (RoutingServiceException $exception) {
            return back()->withInput()->withErrors(['address' => $exception->getMessage()]);
        }

        return redirect()->route('admin.dashboard')
            ->with('status', "Destino imprevisto «{$destination->reference}» agregado a {$vehicle->name}. La ruta del chofer fue recalculada.");
    }
}
