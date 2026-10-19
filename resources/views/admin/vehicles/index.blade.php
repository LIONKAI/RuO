@extends('layouts.admin')

@section('title', 'Flota')

@section('main')
    <div class="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 class="font-display text-3xl font-bold uppercase">Flota</h1>
            <p class="text-sm text-neutral-500">Vehículos de reparto, su chofer asignado y su base de salida.</p>
        </div>
        <a href="{{ route('admin.vehicles.create') }}" class="btn btn-primary">+ Nuevo vehículo</a>
    </div>

    <div class="overflow-x-auto border border-neutral-200">
        <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="bg-neutral-50">
                <tr class="eyebrow">
                    <th class="px-4 py-3 font-normal">Vehículo</th>
                    <th class="px-4 py-3 font-normal">Chofer</th>
                    <th class="px-4 py-3 font-normal">Consumo</th>
                    <th class="px-4 py-3 font-normal">Base / depósito</th>
                    <th class="px-4 py-3 font-normal">Jornadas</th>
                    <th class="px-4 py-3 text-right font-normal">Acciones</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
                @forelse ($vehicles as $vehicle)
                    <tr>
                        <td class="px-4 py-3">
                            <p class="font-semibold">{{ $vehicle->name }}</p>
                            <p class="text-xs text-neutral-500">{{ $vehicle->plate }}</p>
                        </td>
                        <td class="px-4 py-3 text-neutral-600">{{ $vehicle->driver?->name ?? '—' }}</td>
                        <td class="px-4 py-3 text-neutral-600">{{ $vehicle->fuel_liters_per_km }} L/km</td>
                        <td class="px-4 py-3">
                            @if ($vehicle->hasDepot())
                                <span class="tag tag-done">⌂ {{ Str::limit($vehicle->depot_address, 30) }}</span>
                            @else
                                <span class="tag tag-outline">Sin base</span>
                            @endif
                        </td>
                        <td class="px-4 py-3 text-neutral-600">{{ $vehicle->workdays_count }}</td>
                        <td class="px-4 py-3 text-right">
                            <a href="{{ route('admin.destinations.index', $vehicle) }}" class="btn btn-ghost px-2 py-1 text-xs">Jornada</a>
                            <a href="{{ route('admin.vehicles.edit', $vehicle) }}" class="btn btn-ghost px-2 py-1 text-xs">Editar</a>
                            <form method="POST" action="{{ route('admin.vehicles.destroy', $vehicle) }}" class="inline" onsubmit="return confirm('¿Eliminar {{ $vehicle->name }}?')">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-ghost px-2 py-1 text-xs text-alert">Eliminar</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="6" class="px-4 py-10 text-center text-sm text-neutral-500">
                            Todavía no hay vehículos. <a href="{{ route('admin.vehicles.create') }}" class="text-ruo-600 underline">Registra el primero</a>.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
