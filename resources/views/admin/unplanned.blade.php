@extends('layouts.admin')

@section('title', 'Destino imprevisto · '.$vehicle->name)
@section('page', 'admin-unplanned')

@include('partials.leaflet')

@section('main')
    <a href="{{ route('admin.destinations.index', $vehicle) }}" class="mb-3 inline-block text-sm text-ruo-600 hover:text-ruo-800">← Destinos de {{ $vehicle->name }}</a>
    <div class="mb-6">
        <h1 class="font-display text-3xl font-bold uppercase">Agregar destino imprevisto</h1>
        <p class="text-sm text-neutral-500">{{ $vehicle->name }} · {{ $vehicle->plate }} · Chofer: {{ $vehicle->driver?->name ?? 'sin asignar' }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div class="flex flex-col gap-6">
            <section class="corners border border-alert/50 bg-alert-50/40 p-5" style="--corner-color: var(--color-alert)">
                <p class="mb-4 text-sm text-neutral-600">
                    Al guardar, la ruta se recalcula al instante desde el último destino completado
                    ({{ $route['completed'] }} de {{ $route['total'] }}) y el chofer la ve actualizada en segundos.
                </p>
                @include('admin.partials.destination-form', [
                    'action' => route('admin.unplanned.store', $vehicle),
                    'submitLabel' => 'Agregar y recalcular ruta',
                    'unplanned' => true,
                ])
            </section>

            <section>
                <h2 class="eyebrow mb-3">Ruta actual</h2>
                @include('admin.partials.destination-list')
            </section>
        </div>

        <div class="map-box h-[360px] border border-neutral-200 lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]" data-map></div>
    </div>

    <script type="application/json" id="route-data">@json($route)</script>
    @php
        $mapConfig = [
            'center' => [config('services.map.center_latitude'), config('services.map.center_longitude')],
            'geocodeUrl' => route('admin.geocode'),
            'picker' => true,
        ];
    @endphp
    <script type="application/json" id="map-config">@json($mapConfig)</script>
@endsection
