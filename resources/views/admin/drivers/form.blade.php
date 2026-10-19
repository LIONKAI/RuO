@extends('layouts.admin')

@section('title', ($driver->exists ? 'Editar' : 'Nuevo').' chofer')

@section('main')
    <a href="{{ route('admin.drivers.index') }}" class="mb-3 inline-block text-sm text-ruo-600 hover:text-ruo-800">← Choferes</a>
    <div class="mb-6">
        <h1 class="font-display text-3xl font-bold uppercase">{{ $driver->exists ? 'Editar chofer' : 'Nuevo chofer' }}</h1>
        <p class="text-sm text-neutral-500">El chofer inicia sesión con este correo y contraseña desde su celular.</p>
    </div>

    <form method="POST" action="{{ $action }}" class="corners flex max-w-md flex-col gap-4 border border-neutral-200 p-5">
        @csrf
        @if ($method !== 'POST')
            @method($method)
        @endif
        <div>
            <label for="name" class="label">Nombre completo</label>
            <input id="name" name="name" value="{{ old('name', $driver->name) }}" required maxlength="120"
                placeholder="Ej: Carlos Roca" @class(['input', 'border-alert' => $errors->has('name')])>
            @error('name') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
        </div>
        <div>
            <label for="email" class="label">Correo</label>
            <input id="email" name="email" type="email" value="{{ old('email', $driver->email) }}" required maxlength="190"
                placeholder="chofer@empresa.com" @class(['input', 'border-alert' => $errors->has('email')])>
            @error('email') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
        </div>
        <div>
            <label for="password" class="label">
                Contraseña @if ($driver->exists)<span class="font-normal normal-case text-neutral-400">(deja vacío para no cambiar)</span>@endif
            </label>
            <input id="password" name="password" type="password" minlength="6" autocomplete="new-password"
                @if (! $driver->exists) required @endif
                @class(['input', 'border-alert' => $errors->has('password')])>
            @error('password') <p class="mt-1.5 text-sm text-alert">{{ $message }}</p> @enderror
        </div>
        <button type="submit" class="btn btn-primary w-full py-3">{{ $driver->exists ? 'Guardar cambios' : 'Registrar chofer' }}</button>
    </form>
@endsection
