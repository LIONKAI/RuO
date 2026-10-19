@extends('layouts.admin')

@section('title', ($vehicle->exists ? 'Editar' : 'Nuevo').' vehículo')
@section('page', 'admin-vehicle-form')

@include('partials.leaflet')

@section('main')
    <a href="{{ route('admin.vehicles.index') }}" class="mb-3 inline-block text-sm text-ruo-600 hover:text-ruo-800">← Flota</a>
    <div class="mb-6">
        <h1 class="font-display text-3xl font-bold uppercase">{{ $vehicle->exists ? 'Editar vehículo' : 'Nuevo vehículo' }}</h1>
        <p class="text-sm text-neutral-500">La base es el punto de donde arranca la ruta cada día (almacén, taller, casa del chofer).</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <form method="POST" action="{{ $action }}" class="corners flex flex-col gap-4 border border-neutral-200 p-5" data-destination-form>
            @csrf
            @if ($method !== 'POST')
                @method($method)
            @endif
            <div>
                <label for="name" class="label">Nombre</label>
                <input id="name" name="name" value="{{ old('name', $vehicle->name) }}" required maxlength="80"
                    placeholder="Ej: Camioneta 3" @class(['input', 'border-alert' => $errors->has('name')])>
                @error('name') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label for="plate" class="label">Placa</label>
                    <input id="plate" name="plate" value="{{ old('plate', $vehicle->plate) }}" required maxlength="20"
                        placeholder="ABC-123" @class(['input', 'border-alert' => $errors->has('plate')])>
                    @error('plate') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
                </div>
                <div>
                    <label for="fuel_liters_per_km" class="label">Consumo (L/km)</label>
                    <input id="fuel_liters_per_km" name="fuel_liters_per_km" type="number" step="0.001" min="0.01" max="1"
                        value="{{ old('fuel_liters_per_km', $vehicle->fuel_liters_per_km ?? 0.08) }}" required
                        @class(['input', 'border-alert' => $errors->has('fuel_liters_per_km')])>
                    @error('fuel_liters_per_km') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
                </div>
            </div>
            <div>
                <label for="driver_id" class="label">Chofer asignado</label>
                <select id="driver_id" name="driver_id" @class(['input', 'border-alert' => $errors->has('driver_id')])>
                    <option value="">Sin asignar</option>
                    @foreach ($drivers as $driver)
                        <option value="{{ $driver->id }}" @selected((string) old('driver_id', $vehicle->driver_id) === (string) $driver->id)>{{ $driver->name }}</option>
                    @endforeach
                </select>
                @error('driver_id') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
            </div>
            <div>
                <label for="depot_address" class="label">Base / depósito <span class="font-normal normal-case text-neutral-400">(opcional · inicio de la ruta)</span></label>
                <div class="flex gap-2">
                    <input id="depot_address" name="depot_address" value="{{ old('depot_address', $vehicle->depot_address) }}" maxlength="255" autocomplete="off"
                        placeholder="Ej: Zona industrial, km 8" @class(['input', 'border-alert' => $errors->has('depot_address')]) data-address>
                    <button type="button" class="btn btn-secondary shrink-0" data-geocode>Buscar</button>
                </div>
                @error('depot_address') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
                <p class="mt-1.5 text-xs text-neutral-500" data-geocode-status>Busca la dirección o haz clic en el mapa para marcar la base.</p>
                @error('depot_latitude') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
            </div>
            <input type="hidden" name="depot_latitude" value="{{ old('depot_latitude', $vehicle->depot_latitude) }}" data-latitude>
            <input type="hidden" name="depot_longitude" value="{{ old('depot_longitude', $vehicle->depot_longitude) }}" data-longitude>
            <button type="submit" class="btn btn-primary w-full py-3">{{ $vehicle->exists ? 'Guardar cambios' : 'Registrar vehículo' }}</button>
        </form>

        <div class="map-box h-[360px] border border-neutral-200 lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]" data-map></div>
    </div>

    @php
        $mapConfig = [
            'center' => $vehicle->hasDepot()
                ? [$vehicle->depot_latitude, $vehicle->depot_longitude]
                : [config('services.map.center_latitude'), config('services.map.center_longitude')],
            'geocodeUrl' => route('admin.geocode'),
            'picker' => true,
        ];
    @endphp
    <script type="application/json" id="map-config">@json($mapConfig)</script>
@endsection
