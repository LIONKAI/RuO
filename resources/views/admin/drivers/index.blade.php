@extends('layouts.admin')

@section('title', 'Choferes')

@section('main')
    <div class="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 class="font-display text-3xl font-bold uppercase">Choferes</h1>
            <p class="text-sm text-neutral-500">Cuentas de los conductores que siguen la ruta desde el celular.</p>
        </div>
        <a href="{{ route('admin.drivers.create') }}" class="btn btn-primary">+ Nuevo chofer</a>
    </div>

    <div class="overflow-x-auto border border-neutral-200">
        <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-neutral-50">
                <tr class="eyebrow">
                    <th class="px-4 py-3 font-normal">Nombre</th>
                    <th class="px-4 py-3 font-normal">Correo</th>
                    <th class="px-4 py-3 font-normal">Vehículo</th>
                    <th class="px-4 py-3 text-right font-normal">Acciones</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
                @forelse ($drivers as $driver)
                    <tr>
                        <td class="px-4 py-3 font-semibold">{{ $driver->name }}</td>
                        <td class="px-4 py-3 text-neutral-600">{{ $driver->email }}</td>
                        <td class="px-4 py-3">
                            @if ($driver->vehicle)
                                <span class="tag tag-accent">{{ $driver->vehicle->name }}</span>
                            @else
                                <span class="tag tag-outline">Sin vehículo</span>
                            @endif
                        </td>
                        <td class="px-4 py-3 text-right">
                            <a href="{{ route('admin.drivers.edit', $driver) }}" class="btn btn-ghost px-2 py-1 text-xs">Editar</a>
                            <form method="POST" action="{{ route('admin.drivers.destroy', $driver) }}" class="inline" onsubmit="return confirm('¿Eliminar a {{ $driver->name }}? Su vehículo quedará sin chofer.')">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-ghost px-2 py-1 text-xs text-alert">Eliminar</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" class="px-4 py-10 text-center text-sm text-neutral-500">
                            Todavía no hay choferes. <a href="{{ route('admin.drivers.create') }}" class="text-ruo-600 underline">Registra el primero</a>.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
