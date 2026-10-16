<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Driver;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome')->name('landing');

Auth::routes(['register' => false, 'reset' => false, 'confirm' => false, 'verify' => false]);

Route::get('/home', HomeController::class)->middleware('auth')->name('home');

Route::middleware(['auth', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [Admin\DashboardController::class, 'index'])->name('dashboard');
    Route::get('/estado', [Admin\DashboardController::class, 'state'])->name('state');
    Route::get('/resumen', Admin\SummaryController::class)->name('summary');
    Route::get('/geocodificar', Admin\GeocodeController::class)->name('geocode');

    Route::get('/destinos', [Admin\DestinationController::class, 'start'])->name('destinations.start');
    Route::get('/vehiculos/{vehicle}/destinos', [Admin\DestinationController::class, 'index'])->name('destinations.index');
    Route::post('/vehiculos/{vehicle}/destinos', [Admin\DestinationController::class, 'store'])->name('destinations.store');
    Route::delete('/destinos/{destination}', [Admin\DestinationController::class, 'destroy'])->name('destinations.destroy');

    Route::post('/vehiculos/{vehicle}/ruta', [Admin\RouteController::class, 'store'])->name('route.store');

    Route::get('/vehiculos/{vehicle}/imprevisto', [Admin\UnplannedDestinationController::class, 'create'])->name('unplanned.create');
    Route::post('/vehiculos/{vehicle}/imprevisto', [Admin\UnplannedDestinationController::class, 'store'])->name('unplanned.store');
});

Route::middleware(['auth', 'role:driver'])->prefix('chofer')->name('driver.')->group(function () {
    Route::get('/', [Driver\RouteController::class, 'show'])->name('route');
    Route::get('/estado', [Driver\RouteController::class, 'state'])->name('state');
    Route::get('/destino-activo', [Driver\RouteController::class, 'active'])->name('active');
    Route::get('/resumen', [Driver\RouteController::class, 'summary'])->name('summary');
    Route::post('/destinos/{destination}/completar', [Driver\DestinationCompletionController::class, 'store'])->name('destinations.complete');
});
