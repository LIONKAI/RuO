@extends('layouts.driver')

@section('title', 'Resumen de la jornada')
@section('page', 'driver-summary')

@section('main')
    @php($route = $state['route'])
    <div class="flex flex-1 flex-col gap-6 px-5 py-8">
        <div class="text-center">
            <div class="mx-auto mb-4 flex size-16 items-center justify-center bg-done text-3xl text-white">✓</div>
            <h1 class="font-display text-3xl font-bold uppercase">¡Jornada completada!</h1>
            <p class="text-sm text-neutral-500">{{ $route['vehicle']['name'] }} · {{ $route['vehicle']['plate'] }} · {{ \Illuminate\Support\Carbon::parse($route['date'])->format('d/m/Y') }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div class="corners corners-accent col-span-2 border border-ruo-300 bg-ruo-50 px-5 py-5 text-center">
                <p class="eyebrow mb-1">Km totales de la ruta</p>
                <p class="font-display text-5xl leading-none font-extrabold text-ruo-700">{{ number_format($route['total_km'], 1) }}</p>
                <p class="mt-1 text-xs text-neutral-500">kilómetros</p>
            </div>
            <div class="corners border border-neutral-200 px-4 py-4 text-center">
                <p class="eyebrow mb-1">Combustible est.</p>
                <p class="font-display text-3xl leading-none font-extrabold">{{ number_format($route['estimated_fuel_liters'], 2) }}</p>
                <p class="mt-1 text-xs text-neutral-500">litros ({{ $route['vehicle']['fuel_liters_per_km'] }} L/km)</p>
            </div>
            <div class="corners border border-neutral-200 px-4 py-4 text-center">
                <p class="eyebrow mb-1">Destinos</p>
                <p class="font-display text-3xl leading-none font-extrabold text-done">{{ $route['completed'] }}/{{ $route['total'] }}</p>
                <p class="mt-1 text-xs text-neutral-500">completados</p>
            </div>
        </div>

        <section>
            <h2 class="eyebrow mb-2">Recorrido</h2>
            <ol class="divide-y divide-neutral-100 border border-neutral-200">
                @foreach ($route['destinations'] as $destination)
                    <li class="flex items-center gap-3 px-4 py-3">
                        <span class="flex size-6 shrink-0 items-center justify-center bg-done font-display text-xs font-bold text-white">{{ $destination['position'] }}</span>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-semibold">{{ $destination['reference'] }}</p>
                            <p class="truncate text-xs text-neutral-500">{{ $destination['address'] }}</p>
                        </div>
                        @if ($destination['is_unplanned'])
                            <span class="tag tag-alert">Imprevisto</span>
                        @endif
                        <span class="text-xs text-neutral-400">{{ $destination['completed_at'] }}</span>
                    </li>
                @endforeach
            </ol>
        </section>
    </div>
@endsection
