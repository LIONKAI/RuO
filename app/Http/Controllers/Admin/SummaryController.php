<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\View\View;

class SummaryController extends Controller
{
    /**
     * Kilometers and estimated fuel per vehicle for today.
     */
    public function __invoke(): View
    {
        $rows = Vehicle::query()
            ->with(['driver', 'todayWorkday.destinations'])
            ->orderBy('name')
            ->get()
            ->map(function (Vehicle $vehicle) {
                $workday = $vehicle->todayWorkday?->setRelation('vehicle', $vehicle);
                $isCompleted = $workday?->isCompleted() ?? false;
                $km = $isCompleted ? (float) $workday->total_km : ($workday?->drivenKm() ?? 0.0);

                return [
                    'vehicle' => $vehicle,
                    'status_label' => $workday?->status->label() ?? 'Sin iniciar',
                    'is_completed' => $isCompleted,
                    'completed' => $workday?->completedCount() ?? 0,
                    'failed' => $workday?->failedCount() ?? 0,
                    'total' => $workday?->destinations->count() ?? 0,
                    'unplanned' => $workday?->destinations->where('is_unplanned', true)->count() ?? 0,
                    'km' => $km,
                    'fuel' => $isCompleted ? (float) $workday->estimated_fuel_liters : ($workday?->fuelForKm($km) ?? 0.0),
                    'route_km' => $workday?->routeKm() ?? 0.0,
                ];
            });

        return view('admin.summary', [
            'rows' => $rows,
            'totalKm' => round($rows->sum('km'), 2),
            'totalFuel' => round($rows->sum('fuel'), 2),
        ]);
    }
}
