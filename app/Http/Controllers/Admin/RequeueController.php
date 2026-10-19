<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use App\Services\WorkdayManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class RequeueController extends Controller
{
    /**
     * Send a failed destination back to the pool for another date.
     */
    public function store(Request $request, Destination $destination, WorkdayManager $manager): RedirectResponse
    {
        $validated = $request->validate([
            'fecha' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
        ]);

        $this->authorize('requeue', $destination);

        $vehicle = $destination->workday->vehicle;
        $manager->requeue($destination, $validated['fecha']);

        return redirect()->route('admin.destinations.index', $vehicle)
            ->with('status', "«{$destination->reference}» volvió a la cola de pedidos del {$validated['fecha']}.");
    }
}
