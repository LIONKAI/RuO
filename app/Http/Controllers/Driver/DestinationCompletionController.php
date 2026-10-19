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
     * Mark the active destination as completed, with its proof of delivery.
     */
    public function store(Request $request, Destination $destination, WorkdayManager $manager): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'recipient_name' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
            'photo' => ['nullable', 'image', 'max:8192'],
            'signature' => ['nullable', 'string', 'starts_with:data:image/png;base64,'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $destination->load('workday.vehicle', 'workday.destinations');

        $this->authorize('complete', $destination);

        $manager->complete($destination, [...$validated, 'photo' => $request->file('photo')]);

        $finished = $destination->workday->fresh()->isCompleted();
        $redirect = $finished ? route('driver.summary') : null;

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['finished' => $finished, 'redirect' => $redirect]);
        }

        return $finished
            ? redirect()->route('driver.summary')
            : back()->with('status', "«{$destination->reference}» completado.");
    }
}
