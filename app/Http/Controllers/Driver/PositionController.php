<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Services\WorkdayManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PositionController extends Controller
{
    /**
     * Store the driver's current GPS position while the route is running.
     */
    public function store(Request $request, WorkdayManager $manager): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $vehicle = $request->user()->vehicle;
        $workday = $vehicle?->todayWorkday;

        abort_unless($vehicle !== null && $workday?->isInProgress(), 422);

        $manager->recordPosition($workday, (float) $validated['latitude'], (float) $validated['longitude']);

        return response()->json(['ok' => true]);
    }
}
