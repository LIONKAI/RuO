<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use App\Services\WorkdayManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DestinationFailureController extends Controller
{
    /**
     * Mark the active destination as failed with a reason.
     */
    public function store(Request $request, Destination $destination, WorkdayManager $manager): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', Rule::in(array_keys(Destination::FAILURE_REASONS))],
        ]);

        $destination->load('workday.vehicle', 'workday.destinations');

        $this->authorize('fail', $destination);

        $manager->fail($destination, Destination::FAILURE_REASONS[$validated['reason']]);

        $finished = $destination->workday->fresh()->isCompleted();

        return response()->json([
            'finished' => $finished,
            'redirect' => $finished ? route('driver.summary') : null,
        ]);
    }
}
