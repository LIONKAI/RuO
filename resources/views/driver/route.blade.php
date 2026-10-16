@extends('layouts.driver')

@section('title', 'Mi ruta del día')
@section('page', 'driver-route')

@include('partials.leaflet')

@section('main')
    <div class="flex flex-1 flex-col" data-route-root>
        <div class="map-box h-[42vh] min-h-[260px]" data-map></div>
        <div data-active></div>
        <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <span class="eyebrow">Todas las paradas</span>
            <span class="text-xs text-neutral-500" data-progress></span>
        </div>
        <ol data-list></ol>
    </div>
    <div class="hidden flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center" data-empty>
        <div class="flex size-14 items-center justify-center border border-ruo-300 bg-ruo-50 font-display text-2xl text-ruo-600">⌛</div>
        <h1 class="font-display text-2xl font-bold uppercase" data-empty-title>Tu ruta aún no está lista</h1>
        <p class="text-sm text-neutral-500" data-empty-text>Cuando el administrador genere la ruta de hoy, aparecerá aquí automáticamente.</p>
    </div>

    @include('driver.partials.state')
@endsection
