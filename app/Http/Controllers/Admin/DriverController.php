<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDriverRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

/**
 * Management of driver accounts (users with the driver role).
 */
class DriverController extends Controller
{
    /**
     * List drivers and the vehicle each one drives.
     */
    public function index(): View
    {
        return view('admin.drivers.index', [
            'drivers' => User::query()->where('role', UserRole::Driver)->with('vehicle')->orderBy('name')->get(),
        ]);
    }

    /**
     * Form to register a new driver.
     */
    public function create(): View
    {
        return view('admin.drivers.form', [
            'driver' => new User,
            'action' => route('admin.drivers.store'),
            'method' => 'POST',
        ]);
    }

    /**
     * Store the driver account.
     */
    public function store(StoreDriverRequest $request): RedirectResponse
    {
        $driver = User::query()->create([...$request->validated(), 'role' => UserRole::Driver]);

        return redirect()->route('admin.drivers.index')
            ->with('status', "Chofer «{$driver->name}» registrado. Ya puede iniciar sesión.");
    }

    /**
     * Form to edit a driver.
     */
    public function edit(User $driver): View
    {
        abort_unless($driver->isDriver(), 404);

        return view('admin.drivers.form', [
            'driver' => $driver,
            'action' => route('admin.drivers.update', $driver),
            'method' => 'PUT',
        ]);
    }

    /**
     * Update the driver account. An empty password keeps the current one.
     */
    public function update(StoreDriverRequest $request, User $driver): RedirectResponse
    {
        abort_unless($driver->isDriver(), 404);

        $data = $request->safe()->except('password');

        if ($request->filled('password')) {
            $data['password'] = $request->validated('password');
        }

        $driver->update($data);

        return redirect()->route('admin.drivers.index')
            ->with('status', "Chofer «{$driver->name}» actualizado.");
    }

    /**
     * Delete a driver account; its vehicle stays without an assigned driver.
     */
    public function destroy(User $driver): RedirectResponse
    {
        abort_unless($driver->isDriver(), 404);

        $driver->delete();

        return redirect()->route('admin.drivers.index')
            ->with('status', "Chofer «{$driver->name}» eliminado.");
    }
}
