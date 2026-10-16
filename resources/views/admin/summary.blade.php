@extends('layouts.admin')

@section('title', 'Resumen del día')
@section('page', 'admin-summary')

@section('main')
    <div class="mb-7">
        <h1 class="font-display text-3xl font-bold uppercase">Resumen del día</h1>
        <p class="text-sm text-neutral-500">{{ ucfirst(now()->locale('es')->isoFormat('dddd, D [de] MMMM YYYY')) }}</p>
    </div>

    <div class="mb-7 grid grid-cols-2 gap-3 sm:max-w-lg">
        <div class="corners border border-neutral-200 px-5 py-4">
            <p class="eyebrow mb-1">Km totales</p>
            <p class="font-display text-4xl leading-none font-extrabold text-ruo-600">{{ number_format($totalKm, 1) }}</p>
            <p class="mt-1 text-xs text-neutral-400">km</p>
        </div>
        <div class="corners border border-neutral-200 px-5 py-4">
            <p class="eyebrow mb-1">Combustible est.</p>
            <p class="font-display text-4xl leading-none font-extrabold">{{ number_format($totalFuel, 2) }}</p>
            <p class="mt-1 text-xs text-neutral-400">litros</p>
        </div>
    </div>

    <div class="overflow-x-auto border border-neutral-200">
        <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-neutral-50">
                <tr class="eyebrow">
                    <th class="px-4 py-3 font-normal">Vehículo</th>
                    <th class="px-4 py-3 font-normal">Chofer</th>
                    <th class="px-4 py-3 font-normal">Estado</th>
                    <th class="px-4 py-3 font-normal">Destinos</th>
                    <th class="px-4 py-3 text-right font-normal">Km</th>
                    <th class="px-4 py-3 text-right font-normal">Combustible</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
                @foreach ($rows as $row)
                    <tr>
                        <td class="px-4 py-3">
                            <p class="font-semibold">{{ $row['vehicle']->name }}</p>
                            <p class="text-xs text-neutral-500">{{ $row['vehicle']->plate }} · {{ $row['vehicle']->fuel_liters_per_km }} L/km</p>
                        </td>
                        <td class="px-4 py-3 text-neutral-600">{{ $row['vehicle']->driver?->name ?? '—' }}</td>
                        <td class="px-4 py-3">
                            <span @class(['tag', 'tag-done' => $row['is_completed'], 'tag-outline' => ! $row['is_completed']])>{{ $row['status_label'] }}</span>
                        </td>
                        <td class="px-4 py-3 text-neutral-600">
                            {{ $row['completed'] }} / {{ $row['total'] }}
                            @if ($row['unplanned'])
                                <span class="text-xs text-alert">({{ $row['unplanned'] }} imprevisto{{ $row['unplanned'] > 1 ? 's' : '' }})</span>
                            @endif
                        </td>
                        <td class="px-4 py-3 text-right font-semibold">
                            {{ number_format($row['km'], 1) }} km
                            @unless ($row['is_completed'])
                                <p class="text-xs font-normal text-neutral-400">recorridos de {{ number_format($row['route_km'], 1) }}</p>
                            @endunless
                        </td>
                        <td class="px-4 py-3 text-right font-semibold">{{ number_format($row['fuel'], 2) }} L</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    <p class="mt-3 text-xs text-neutral-500">El combustible estimado se calcula multiplicando los km de la ruta por el consumo de cada vehículo. Las jornadas en curso muestran los km recorridos hasta ahora.</p>
@endsection
