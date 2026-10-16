<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Services\RouteOptimizer;
use App\Services\RoutingServiceException;
use Illuminate\Http\RedirectResponse;

class RouteController extends Controller
{
    /**
     * Generate the optimized route of today's workday and start it.
     */
    public function store(Vehicle $vehicle, RouteOptimizer $optimizer): RedirectResponse
    {
        $workday = $vehicle->workdayForToday();

        if (! $workday->isDraft()) {
            return redirect()->route('admin.destinations.index', $vehicle)
                ->with('error', 'La ruta de hoy ya fue generada.');
        }

        if (! $workday->destinations()->exists()) {
            return redirect()->route('admin.destinations.index', $vehicle)
                ->with('error', 'No se puede iniciar la jornada sin al menos un destino cargado.');
        }

        try {
            $optimizer->optimize($workday);
        } catch (RoutingServiceException $exception) {
            return redirect()->route('admin.destinations.index', $vehicle)->with('error', $exception->getMessage());
        }

        return redirect()->route('admin.destinations.index', $vehicle)
            ->with('status', 'Ruta optimizada generada y enviada al chofer.');
    }
}
