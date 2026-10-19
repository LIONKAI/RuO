<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDestinationRequest;
use App\Models\Destination;
use App\Models\Vehicle;
use App\Services\FleetOptimizer;
use App\Services\RoutingServiceException;
use App\Services\WorkdayManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

/**
 * The daily delivery pool: destinations waiting to be distributed among the fleet.
 */
class PoolController extends Controller
{
    /**
     * Show the delivery pool of a date with the form to add more.
     */
    public function index(Request $request): View
    {
        $date = $this->date($request);
        $pool = Destination::query()->inPool($date->toDateString())->get();

        return view('admin.pool', [
            'date' => $date,
            'pool' => $pool,
            'vehicles' => Vehicle::query()->orderBy('name')->get(),
        ]);
    }

    /**
     * Add one delivery to the pool.
     */
    public function store(StoreDestinationRequest $request, WorkdayManager $manager): RedirectResponse
    {
        $date = $this->date($request)->toDateString();

        try {
            $data = $manager->resolveCoordinates($request->validated());
        } catch (RoutingServiceException $exception) {
            return back()->withInput()->withErrors(['address' => $exception->getMessage()]);
        }

        $destination = Destination::query()->create([...$data, 'service_date' => $date]);

        return redirect()->route('admin.pool.index', ['fecha' => $date])
            ->with('status', "Pedido «{$destination->reference}» agregado a la cola del {$this->formatDate($date)}.");
    }

    /**
     * Bulk import deliveries, one per line: "dirección | referencia | teléfono".
     * Reference and phone are optional.
     */
    public function import(Request $request, WorkdayManager $manager): RedirectResponse
    {
        $validated = $request->validate([
            'lines' => ['required', 'string', 'max:20000'],
        ], ['required' => 'Pega al menos una dirección.']);

        $date = $this->date($request)->toDateString();
        $imported = 0;
        $failed = [];

        foreach (preg_split('/\r?\n/', $validated['lines']) as $line) {
            $line = trim($line);

            if ($line === '') {
                continue;
            }

            [$address, $reference, $phone] = array_pad(array_map('trim', explode('|', $line)), 3, null);

            try {
                $data = $manager->resolveCoordinates([
                    'address' => $address,
                    'reference' => $reference ?: $address,
                    'phone' => $phone ?: null,
                ]);

                Destination::query()->create([...$data, 'service_date' => $date]);
                $imported++;
            } catch (RoutingServiceException) {
                $failed[] = $address;
            }
        }

        $redirect = redirect()->route('admin.pool.index', ['fecha' => $date]);

        if ($imported > 0) {
            $redirect->with('status', "{$imported} pedido(s) importados a la cola del {$this->formatDate($date)}.");
        }

        if ($failed !== []) {
            $redirect->with('error', 'No se pudo ubicar: '.implode(' · ', array_slice($failed, 0, 5)).(count($failed) > 5 ? '…' : ''));
        }

        return $redirect;
    }

    /**
     * Remove a delivery still waiting in the pool.
     */
    public function destroy(Destination $destination): RedirectResponse
    {
        if (! $destination->isPool()) {
            return redirect()->route('admin.pool.index')
                ->with('error', 'Ese pedido ya fue asignado a una ruta.');
        }

        $date = $destination->service_date->toDateString();
        $destination->delete();

        return redirect()->route('admin.pool.index', ['fecha' => $date])
            ->with('status', 'Pedido eliminado de la cola.');
    }

    /**
     * Split the pool among the fleet and start each vehicle's optimized route.
     */
    public function distribute(Request $request, FleetOptimizer $fleet): RedirectResponse
    {
        $date = $this->date($request)->toDateString();

        $vehicles = Vehicle::query()
            ->when($request->input('vehicles'), fn ($query, array $ids) => $query->whereIn('id', $ids))
            ->orderBy('name')
            ->get();

        try {
            $result = $fleet->distribute($date, $vehicles);
        } catch (RoutingServiceException $exception) {
            return redirect()->route('admin.pool.index', ['fecha' => $date])->with('error', $exception->getMessage());
        }

        return redirect()->route('admin.dashboard')
            ->with('status', "{$result['assigned']} pedido(s) repartidos en {$result['routes']} ruta(s). Cada chofer ya ve su recorrido.");
    }

    /**
     * The pool date requested in ?fecha=YYYY-MM-DD, today by default.
     */
    protected function date(Request $request): Carbon
    {
        try {
            return Carbon::createFromFormat('Y-m-d', (string) $request->input('fecha', today()->toDateString()))->startOfDay();
        } catch (\Throwable) {
            return today();
        }
    }

    protected function formatDate(string $date): string
    {
        return Carbon::parse($date)->format('d/m/Y');
    }
}
