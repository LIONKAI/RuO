<?php

namespace App\Policies;

use App\Models\Destination;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class DestinationPolicy
{
    /**
     * Only the driver assigned to the vehicle can complete its active destination.
     */
    public function complete(User $user, Destination $destination): Response
    {
        $workday = $destination->workday;

        if (! $user->isDriver() || $workday->vehicle->driver_id !== $user->id) {
            return Response::deny('Solo el chofer asignado a este vehículo puede completar este destino.');
        }

        if (! $workday->isInProgress() || ! $destination->isPending()) {
            return Response::deny('Este destino ya no está pendiente.');
        }

        if ($workday->activeDestination()?->id !== $destination->id) {
            return Response::deny('Completa los destinos en el orden de la ruta.');
        }

        return Response::allow();
    }

    /**
     * The assigned driver can mark the active destination as failed.
     */
    public function fail(User $user, Destination $destination): Response
    {
        return $this->complete($user, $destination);
    }

    /**
     * Planned destinations can only be removed by an admin before the route is generated.
     */
    public function delete(User $user, Destination $destination): Response
    {
        return $user->isAdmin() && $destination->workday->isDraft()
            ? Response::allow()
            : Response::deny('Ya no se pueden eliminar destinos: la ruta del día ya fue generada.');
    }

    /**
     * Only a failed destination can be sent back to the pool by an admin.
     */
    public function requeue(User $user, Destination $destination): Response
    {
        return $user->isAdmin() && $destination->isFailed()
            ? Response::allow()
            : Response::deny('Solo los destinos fallidos pueden volver a la cola.');
    }
}
