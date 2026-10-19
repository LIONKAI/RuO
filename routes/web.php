<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Driver;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\TrackingController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome')->name('landing');

// Public delivery tracking — the customer opens the shared secret link.
Route::get('/rastreo/{token}', [TrackingController::class, 'show'])->name('tracking.show');
Route::get('/rastreo/{token}/estado', [TrackingController::class, 'state'])->name('tracking.state');

Auth::routes(['register' => false, 'reset' => false, 'confirm' => false, 'verify' => false]);

Route::get('/home', HomeController::class)->middleware('auth')->name('home');

Route::middleware(['auth', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [Admin\DashboardController::class, 'index'])->name('dashboard');
    Route::get('/estado', [Admin\DashboardController::class, 'state'])->name('state');
    Route::get('/resumen', Admin\SummaryController::class)->name('summary');
    Route::get('/geocodificar', Admin\GeocodeController::class)->name('geocode');

    // Delivery pool: load orders and split them among the fleet.
    Route::get('/pedidos', [Admin\PoolController::class, 'index'])->name('pool.index');
    Route::post('/pedidos', [Admin\PoolController::class, 'store'])->name('pool.store');
    Route::post('/pedidos/importar', [Admin\PoolController::class, 'import'])->name('pool.import');
    Route::delete('/pedidos/{destination}', [Admin\PoolController::class, 'destroy'])->name('pool.destroy');
    Route::post('/pedidos/distribuir', [Admin\PoolController::class, 'distribute'])->name('pool.distribute');

    // Fleet and drivers management.
    Route::resource('vehiculos', Admin\VehicleController::class)->except('show')->names('vehicles')->parameters(['vehiculos' => 'vehicle']);
    Route::resource('choferes', Admin\DriverController::class)->except('show')->names('drivers')->parameters(['choferes' => 'driver']);

    Route::get('/destinos', [Admin\DestinationController::class, 'start'])->name('destinations.start');
    Route::get('/vehiculos/{vehicle}/destinos', [Admin\DestinationController::class, 'index'])->name('destinations.index');
    Route::post('/vehiculos/{vehicle}/destinos', [Admin\DestinationController::class, 'store'])->name('destinations.store');
    Route::delete('/destinos/{destination}', [Admin\DestinationController::class, 'destroy'])->name('destinations.destroy');
    Route::post('/destinos/{destination}/reagendar', [Admin\RequeueController::class, 'store'])->name('destinations.requeue');

    Route::post('/vehiculos/{vehicle}/ruta', [Admin\RouteController::class, 'store'])->name('route.store');

    Route::get('/vehiculos/{vehicle}/imprevisto', [Admin\UnplannedDestinationController::class, 'create'])->name('unplanned.create');
    Route::post('/vehiculos/{vehicle}/imprevisto', [Admin\UnplannedDestinationController::class, 'store'])->name('unplanned.store');
});

Route::middleware(['auth', 'role:driver'])->prefix('chofer')->name('driver.')->group(function () {
    Route::get('/', [Driver\RouteController::class, 'show'])->name('route');
    Route::get('/estado', [Driver\RouteController::class, 'state'])->name('state');
    Route::get('/destino-activo', [Driver\RouteController::class, 'active'])->name('active');
    Route::get('/resumen', [Driver\RouteController::class, 'summary'])->name('summary');
    Route::post('/posicion', [Driver\PositionController::class, 'store'])->name('position.store');
    Route::post('/destinos/{destination}/completar', [Driver\DestinationCompletionController::class, 'store'])->name('destinations.complete');
    Route::post('/destinos/{destination}/fallido', [Driver\DestinationFailureController::class, 'store'])->name('destinations.fail');
});
