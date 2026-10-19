@extends('layouts.admin')

@section('title', 'Panel general')
@section('page', 'admin-dashboard')

@include('partials.leaflet')

@section('main')
    <div class="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 class="font-display text-3xl font-bold uppercase">Panel general</h1>
            <p class="flex items-center gap-2 text-sm text-neutral-500">
                <span class="live-dot inline-block size-2 rounded-full bg-done"></span>
                {{ ucfirst(now()->locale('es')->isoFormat('dddd, D [de] MMMM YYYY')) }} · En vivo
                <span class="text-neutral-400" data-updated-at></span>
            </p>
        </div>
        <a href="{{ route('admin.destinations.start') }}" class="btn btn-primary">+ Cargar destinos</a>
    </div>

    <div class="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4" data-stats></div>

    <div class="map-box mb-7 hidden h-[380px] border border-neutral-200" data-fleet-map></div>

    <div class="mb-4 flex items-center gap-3">
        <span class="eyebrow">Estado de vehículos</span>
        <div class="h-px flex-1 bg-neutral-200"></div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-vehicles></div>

    <p class="mt-6 hidden text-sm text-alert" data-connection-error>Sin conexión con el servidor. Reintentando…</p>

    <script type="application/json" id="initial-state">@json($initialState)</script>
    <script type="application/json" id="state-config">@json(['url' => route('admin.state')])</script>
@endsection
