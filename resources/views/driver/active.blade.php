@extends('layouts.driver')

@section('title', 'Destino activo')
@section('page', 'driver-active')

@include('partials.leaflet')

@section('main')
    <div class="flex flex-1 flex-col" data-route-root>
        <a href="{{ route('driver.route') }}" class="border-b border-neutral-200 px-4 py-3 text-sm text-ruo-600">← Mi ruta del día</a>
        <div class="map-box h-[34vh] min-h-[220px]" data-map></div>
        <div data-active></div>
        <div class="border-b border-neutral-200 px-4 py-3"><span class="eyebrow">Indicaciones para llegar</span></div>
        <ol class="divide-y divide-neutral-100" data-steps></ol>
    </div>
    <div class="hidden flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center" data-empty>
        <h1 class="font-display text-2xl font-bold uppercase" data-empty-title>Tu ruta aún no está lista</h1>
        <p class="text-sm text-neutral-500" data-empty-text>Cuando el administrador genere la ruta de hoy, aparecerá aquí automáticamente.</p>
    </div>

    @include('driver.partials.state')
@endsection
