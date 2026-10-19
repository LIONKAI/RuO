<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVehicleRequest;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\View\View;

class VehicleController extends Controller
{
    /**
     * List the fleet with each vehicle's driver and depot.
     */
    public function index(): View
    {
        return view('admin.vehicles.index', [
            'vehicles' => Vehicle::query()->with('driver')->withCount('workdays')->orderBy('name')->get(),
        ]);
    }

    /**
     * Form to register a new vehicle.
     */
    public function create(): View
    {
        return view('admin.vehicles.form', [
            'vehicle' => new Vehicle,
            'drivers' => $this->drivers(),
            'action' => route('admin.vehicles.store'),
            'method' => 'POST',
        ]);
    }

    /**
     * Store the vehicle.
     */
    public function store(StoreVehicleRequest $request): RedirectResponse
    {
        $vehicle = Vehicle::query()->create($request->validated());

        return redirect()->route('admin.vehicles.index')
            ->with('status', "Vehículo «{$vehicle->name}» registrado.");
    }

    /**
     * Form to edit a vehicle.
     */
    public function edit(Vehicle $vehicle): View
    {
        return view('admin.vehicles.form', [
            'vehicle' => $vehicle,
            'drivers' => $this->drivers(),
            'action' => route('admin.vehicles.update', $vehicle),
            'method' => 'PUT',
        ]);
    }

    /**
     * Update the vehicle.
     */
    public function update(StoreVehicleRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $vehicle->update($request->validated());

        return redirect()->route('admin.vehicles.index')
            ->with('status', "Vehículo «{$vehicle->name}» actualizado.");
    }

    /**
     * Delete a vehicle that never ran a route.
     */
    public function destroy(Vehicle $vehicle): RedirectResponse
    {
        if ($vehicle->workdays()->exists()) {
            return redirect()->route('admin.vehicles.index')
                ->with('error', "«{$vehicle->name}» tiene jornadas registradas y no se puede eliminar.");
        }

        $vehicle->delete();

        return redirect()->route('admin.vehicles.index')
            ->with('status', "Vehículo «{$vehicle->name}» eliminado.");
    }

    /**
     * Users with the driver role, available to be assigned to a vehicle.
     *
     * @return Collection<int, User>
     */
    protected function drivers()
    {
        return User::query()
            ->where('role', UserRole::Driver)
            ->orderBy('name')
            ->get(['id', 'name']);
    }
}
