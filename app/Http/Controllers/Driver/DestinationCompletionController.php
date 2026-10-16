<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use App\Services\WorkdayManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DestinationCompletionController extends Controller
{
    /**
     * Mark the active destination as completed.
     */
    public function store(Request $request, Destination $destination, WorkdayManager $manager): JsonResponse|RedirectResponse
    {
        $destination->load('workday.vehicle', 'workday.destinations');

        $this->authorize('complete', $destination);

        $manager->complete($destination);

        $finished = $destination->workday->fresh()->isCompleted();
        $redirect = $finished ? route('driver.summary') : null;

        if ($request->expectsJson()) {
            return response()->json(['finished' => $finished, 'redirect' => $redirect]);
        }

        return $finished
            ? redirect()->route('driver.summary')
            : back()->with('status', "«{$destination->reference}» completado.");
    }
}
