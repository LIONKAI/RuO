@extends('layouts.admin')

@section('title', 'Destinos · '.$vehicle->name)
@section('page', 'admin-destinations')

@include('partials.leaflet')

@section('main')
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 class="font-display text-3xl font-bold uppercase">Destinos {{ $date->isToday() ? 'del día' : 'del '.$date->format('d/m/Y') }}</h1>
            <p class="text-sm text-neutral-500">{{ $vehicle->name }} · {{ $vehicle->plate }} · Chofer: {{ $vehicle->driver?->name ?? 'sin asignar' }}</p>
        </div>
        <div class="flex items-end gap-3">
            <form method="GET" action="{{ route('admin.destinations.index', $vehicle) }}" class="flex items-end gap-2">
                <div>
                    <label for="fecha" class="label">Fecha</label>
                    <input type="date" id="fecha" name="fecha" value="{{ $date->toDateString() }}" class="input">
                </div>
                <button type="submit" class="btn btn-secondary">Ver</button>
            </form>
            <span @class([
                'tag text-xs',
                'tag-outline' => $workday->isDraft(),
                'tag-accent' => $workday->isInProgress(),
                'tag-done' => $workday->isCompleted(),
            ])>{{ $workday->status->label() }}</span>
        </div>
    </div>

    @include('admin.partials.vehicle-tabs')

    <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div class="flex flex-col gap-6">
            @if ($workday->isDraft())
                <section class="corners border border-neutral-200 p-5">
                    <h2 class="mb-4 font-display text-lg font-bold uppercase">Agregar destino</h2>
                    @include('admin.partials.destination-form', [
                        'action' => route('admin.destinations.store', $vehicle),
                        'submitLabel' => '+ Agregar destino',
                        'dateField' => $date->toDateString(),
                    ])
                </section>
            @else
                <section class="corners corners-accent border border-ruo-300 bg-ruo-50 p-5">
                    <h2 class="mb-1 font-display text-lg font-bold uppercase">Ruta en curso</h2>
                    <p class="mb-4 text-sm text-neutral-600">
                        {{ $route['completed'] }} de {{ $route['total'] }} completados · {{ number_format($route['route_km'], 1) }} km de ruta ·
                        {{ number_format($route['route_fuel'], 2) }} L estimados
                        @if ($route['failed'] ?? 0)
                            · <span class="font-semibold text-alert">{{ $route['failed'] }} fallido(s)</span>
                        @endif
                    </p>
                    @if ($date->isToday())
                        <a href="{{ route('admin.unplanned.create', $vehicle) }}" class="btn btn-alert w-full">+ Agregar destino imprevisto</a>
                    @endif
                </section>
            @endif

            <section>
                <div class="mb-3 flex items-center justify-between">
                    <h2 class="eyebrow">{{ $workday->isDraft() ? 'Destinos cargados' : 'Orden optimizado' }} ({{ $workday->destinations->count() }})</h2>
                </div>
                @include('admin.partials.destination-list')
            </section>

            @if ($workday->isDraft())
                <form method="POST" action="{{ route('admin.route.store', $vehicle) }}" data-generate-route>
                    @csrf
                    <input type="hidden" name="fecha" value="{{ $date->toDateString() }}">
                    <button type="submit" class="btn btn-primary w-full py-3 text-base" @disabled($workday->destinations->isEmpty())>
                        Generar ruta optimizada →
                    </button>
                    @if ($workday->destinations->isEmpty())
                        <p class="mt-2 text-xs text-neutral-500">Carga al menos un destino o <a href="{{ route('admin.pool.index', ['fecha' => $date->toDateString()]) }}" class="text-ruo-600 underline">reparte la cola de pedidos</a>.</p>
                    @elseif (! $vehicle->hasDepot())
                        <p class="mt-2 text-xs text-neutral-500">Sin base definida, la ruta empieza en el mejor punto. <a href="{{ route('admin.vehicles.edit', $vehicle) }}" class="text-ruo-600 underline">Define el depósito del vehículo</a>.</p>
                    @endif
                </form>
            @endif
        </div>

        <div class="map-box h-[360px] border border-neutral-200 lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]" data-map></div>
    </div>

    <script type="application/json" id="route-data">@json($route)</script>
    @php
        $mapConfig = [
            'center' => [config('services.map.center_latitude'), config('services.map.center_longitude')],
            'geocodeUrl' => route('admin.geocode'),
            'picker' => $workday->isDraft(),
        ];
    @endphp
    <script type="application/json" id="map-config">@json($mapConfig)</script>
@endsection
