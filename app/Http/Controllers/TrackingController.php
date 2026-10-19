<?php

namespace App\Http\Controllers;

use App\Enums\DestinationStatus;
use App\Models\Destination;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\View\View;

/**
 * Public live tracking page a customer opens from the shared link:
 * shows the delivery status, the remaining stops ahead and the vehicle's
 * last reported position. No authentication — access is the secret token.
 */
class TrackingController extends Controller
{
    /**
     * Render the tracking page.
     */
    public function show(string $token): View
    {
        return view('tracking.show', [
            'token' => $token,
            'initialState' => $this->payload($this->find($token)),
        ]);
    }

    /**
     * Live payload polled by the tracking page.
     */
    public function state(string $token): JsonResponse
    {
        return response()->json($this->payload($this->find($token)));
    }

    protected function find(string $token): Destination
    {
        return Destination::query()
            ->where('public_token', $token)
            ->with(['workday.vehicle', 'workday.destinations'])
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    protected function payload(Destination $destination): array
    {
        $workday = $destination->workday;

        if ($workday === null) {
            return [
                'reference' => $destination->reference,
                'address' => $destination->address,
                'status' => 'scheduled',
                'status_label' => 'Programada',
                'service_date' => $destination->service_date?->format('d/m/Y'),
                'message' => 'Tu entrega está programada. Te avisaremos cuando el repartidor salga.',
                'destination' => $this->point($destination),
                'vehicle' => null,
                'queue_position' => null,
                'eta_minutes' => null,
                'legs' => [],
            ];
        }

        $ahead = $workday->destinations
            ->where('status', DestinationStatus::Pending)
            ->sortBy('position')
            ->values();

        $queuePosition = $ahead->search(fn (Destination $item) => $item->id === $destination->id);
        $stopsAhead = $queuePosition === false ? 0 : $queuePosition;
        $etaSeconds = $ahead->take($stopsAhead + 1)->sum('leg_duration_seconds');

        return [
            'reference' => $destination->reference,
            'address' => $destination->address,
            'status' => $destination->status->value,
            'status_label' => $destination->status->label(),
            'service_date' => $destination->service_date?->format('d/m/Y'),
            'completed_at' => $destination->completed_at?->format('H:i'),
            'failure_reason' => $destination->failure_reason,
            'message' => $this->message($destination, $workday->isInProgress(), $stopsAhead),
            'destination' => $this->point($destination),
            'vehicle' => [
                'name' => $workday->vehicle->name,
                'plate' => $workday->vehicle->plate,
                'position' => $workday->lastPosition(),
            ],
            'queue_position' => $destination->isPending() ? $stopsAhead : null,
            'eta_minutes' => $destination->isPending() && $workday->isInProgress() ? (int) ceil($etaSeconds / 60) : null,
            'legs' => $this->legs($ahead, $destination, $queuePosition),
            'signature' => implode('-', [
                $workday->route_version,
                $destination->status->value,
                $workday->last_position_at?->timestamp ?? 0,
            ]),
        ];
    }

    /**
     * Human message summarizing where the delivery stands.
     */
    protected function message(Destination $destination, bool $running, int $stopsAhead): string
    {
        if ($destination->isCompleted()) {
            return 'Tu entrega fue completada.';
        }

        if ($destination->isFailed()) {
            return "No pudimos completar la entrega ({$destination->failure_reason}). La estamos reagendando.";
        }

        if (! $running) {
            return 'Tu entrega está asignada. El repartidor aún no sale.';
        }

        return $stopsAhead === 0
            ? 'El repartidor va en camino a tu dirección.'
            : "El repartidor está en ruta: te faltan {$stopsAhead} parada(s) por delante.";
    }

    /**
     * Route legs still to drive up to (and including) this destination,
     * for drawing the remaining path on the customer's map.
     *
     * @param  Collection<int, Destination>  $ahead
     * @return list<list<array{0: float, 1: float}>>
     */
    protected function legs(Collection $ahead, Destination $destination, int|false $queuePosition): array
    {
        if ($queuePosition === false) {
            return [];
        }

        return $ahead
            ->take($queuePosition + 1)
            ->pluck('leg_geometry')
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array{latitude: float, longitude: float}
     */
    protected function point(Destination $destination): array
    {
        return ['latitude' => $destination->latitude, 'longitude' => $destination->longitude];
    }
}
