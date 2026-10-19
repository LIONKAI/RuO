@extends('layouts.admin')

@section('title', 'Cola de pedidos')
@section('page', 'admin-pool')

@include('partials.leaflet')

@section('main')
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 class="font-display text-3xl font-bold uppercase">Cola de pedidos</h1>
            <p class="text-sm text-neutral-500">
                Pedidos esperando reparto para el <strong>{{ $date->format('d/m/Y') }}</strong>.
                Repártelos entre la flota y cada chofer recibe su ruta optimizada.
            </p>
        </div>
        <form method="GET" action="{{ route('admin.pool.index') }}" class="flex items-end gap-2">
            <div>
                <label for="fecha" class="label">Fecha de reparto</label>
                <input type="date" id="fecha" name="fecha" value="{{ $date->toDateString() }}" class="input">
            </div>
            <button type="submit" class="btn btn-secondary">Ver</button>
        </form>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div class="flex flex-col gap-6">
            <section class="corners border border-neutral-200 p-5">
                <h2 class="mb-4 font-display text-lg font-bold uppercase">Agregar pedido</h2>
                @include('admin.partials.destination-form', [
                    'action' => route('admin.pool.store'),
                    'submitLabel' => '+ Agregar a la cola',
                    'dateField' => $date->toDateString(),
                ])
            </section>

            <details class="corners border border-neutral-200 p-5">
                <summary class="cursor-pointer font-display text-lg font-bold uppercase">Carga masiva</summary>
                <p class="mt-2 mb-3 text-xs text-neutral-500">
                    Una dirección por línea. Opcional: <code>dirección | referencia | teléfono</code>.
                </p>
                <form method="POST" action="{{ route('admin.pool.import') }}" class="flex flex-col gap-3">
                    @csrf
                    <input type="hidden" name="fecha" value="{{ $date->toDateString() }}">
                    <textarea name="lines" rows="5" class="input font-mono text-xs" placeholder="Av. Cañoto 450 | Ferretería El Constructor | 70012345&#10;Calle Murillo 120 | Distribuidora Norte&#10;Av. Busch 890"></textarea>
                    @error('lines')
                        <p class="text-sm text-alert">{{ $message }}</p>
                    @enderror
                    <button type="submit" class="btn btn-secondary w-full">Importar y geocodificar</button>
                    <p class="text-xs text-neutral-400">Cada dirección se ubica con el servicio de mapas; puede tardar unos segundos por línea.</p>
                </form>
            </details>

            <section>
                <div class="mb-3 flex items-center justify-between">
                    <h2 class="eyebrow">En cola ({{ $pool->count() }})</h2>
                </div>
                <ol class="divide-y divide-neutral-100 border border-neutral-200">
                    @forelse ($pool as $destination)
                        <li class="flex items-center gap-3 px-4 py-3">
                            <span class="flex size-7 shrink-0 items-center justify-center border border-neutral-300 font-display text-sm font-bold text-neutral-400">{{ $loop->iteration }}</span>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-semibold">{{ $destination->reference }}</p>
                                <p class="truncate text-xs text-neutral-500">{{ $destination->address }}</p>
                            </div>
                            @if ($destination->phone)
                                <a href="{{ app(\App\Services\WhatsApp::class)->trackingLink($destination) }}" target="_blank" rel="noopener" class="tag tag-done" title="Avisar por WhatsApp">WhatsApp</a>
                            @endif
                            <form method="POST" action="{{ route('admin.pool.destroy', $destination) }}">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-ghost px-2 py-1 text-xs" aria-label="Eliminar {{ $destination->reference }}">Eliminar</button>
                            </form>
                        </li>
                    @empty
                        <li class="px-4 py-8 text-center text-sm text-neutral-500">La cola está vacía para esta fecha.</li>
                    @endforelse
                </ol>
            </section>

            <form method="POST" action="{{ route('admin.pool.distribute') }}" data-distribute>
                @csrf
                <input type="hidden" name="fecha" value="{{ $date->toDateString() }}">
                <div class="mb-3 border border-neutral-200 px-4 py-3">
                    <p class="eyebrow mb-2">Repartir entre</p>
                    <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                        @foreach ($vehicles as $vehicle)
                            <label class="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="vehicles[]" value="{{ $vehicle->id }}" checked class="accent-ruo-600">
                                {{ $vehicle->name }}
                                @unless ($vehicle->hasDepot())
                                    <span class="text-[10px] text-alert">sin base</span>
                                @endunless
                            </label>
                        @endforeach
                    </div>
                </div>
                <button type="submit" class="btn btn-primary w-full py-3 text-base" @disabled($pool->isEmpty() || $vehicles->isEmpty())>
                    Repartir {{ $pool->count() }} pedido(s) y optimizar rutas →
                </button>
                @if ($vehicles->isEmpty())
                    <p class="mt-2 text-xs text-alert">No hay vehículos. <a href="{{ route('admin.vehicles.create') }}" class="underline">Registra el primero</a>.</p>
                @endif
            </form>
        </div>

        <div class="map-box h-[360px] border border-neutral-200 lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]" data-map></div>
    </div>

    @php
        $poolData = [
            'depots' => $vehicles->filter->hasDepot()->map(fn ($v) => ['name' => $v->name, 'latitude' => $v->depot_latitude, 'longitude' => $v->depot_longitude])->values(),
            'destinations' => $pool->map(fn ($d) => ['id' => $d->id, 'reference' => $d->reference, 'address' => $d->address, 'latitude' => $d->latitude, 'longitude' => $d->longitude])->values(),
        ];
        $mapConfig = [
            'center' => [config('services.map.center_latitude'), config('services.map.center_longitude')],
            'geocodeUrl' => route('admin.geocode'),
            'picker' => true,
        ];
    @endphp
    <script type="application/json" id="pool-data">@json($poolData)</script>
    <script type="application/json" id="map-config">@json($mapConfig)</script>
@endsection
