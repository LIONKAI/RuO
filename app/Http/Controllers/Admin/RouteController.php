<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Services\RouteOptimizer;
use App\Services\RoutingServiceException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RouteController extends Controller
{
    /**
     * Generate the optimized route of a vehicle's workday and activate it.
     */
    public function store(Request $request, Vehicle $vehicle, RouteOptimizer $optimizer): RedirectResponse
    {
        try {
            $date = Carbon::createFromFormat('Y-m-d', (string) $request->input('fecha', today()->toDateString()))->toDateString();
        } catch (\Throwable) {
            $date = today()->toDateString();
        }

        $workday = $vehicle->workdayFor($date);
        $back = ['vehicle' => $vehicle, 'fecha' => $date];

        if (! $workday->isDraft()) {
            return redirect()->route('admin.destinations.index', $back)
                ->with('error', 'La ruta de esa fecha ya fue generada.');
        }

        if (! $workday->destinations()->exists()) {
            return redirect()->route('admin.destinations.index', $back)
                ->with('error', 'No se puede iniciar la jornada sin al menos un destino cargado.');
        }

        try {
            $optimizer->optimize($workday);
        } catch (RoutingServiceException $exception) {
            return redirect()->route('admin.destinations.index', $back)->with('error', $exception->getMessage());
        }

        return redirect()->route('admin.destinations.index', $back)
            ->with('status', 'Ruta optimizada generada y enviada al chofer.');
    }
}
