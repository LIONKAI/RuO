@extends('layouts.ruo')

@section('title', 'Ingresar')
@section('page', 'login')

@section('content')
    <div class="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12">
        <a href="{{ route('landing') }}" class="fixed top-5 left-6 text-sm text-ruo-600 hover:text-ruo-800">← Inicio</a>

        <div class="w-full max-w-sm">
            <div class="mb-10 text-center">
                <div class="mb-2">@include('partials.logo', ['size' => 40])</div>
                <p class="text-sm text-neutral-500">Ingresa con tu cuenta de administrador o de chofer</p>
            </div>

            @include('partials.flash')

            <form method="POST" action="{{ route('login') }}" class="flex flex-col gap-4">
                @csrf

                <div>
                    <label for="email" class="label">Correo</label>
                    <input id="email" type="email" name="email" value="{{ old('email') }}" required autocomplete="email" autofocus
                        inputmode="email" placeholder="admin@empresa.bo" @class(['input', 'border-alert' => $errors->has('email')])>
                    @error('email')
                        <p class="mt-1.5 text-sm text-alert">Correo o contraseña incorrectos.</p>
                    @enderror
                </div>

                <div>
                    <label for="password" class="label">Contraseña</label>
                    <input id="password" type="password" name="password" required autocomplete="current-password" placeholder="••••••••" class="input">
                </div>

                <label class="flex items-center gap-2 text-sm text-neutral-600">
                    <input type="checkbox" name="remember" class="size-4 accent-ruo-600" @checked(old('remember'))>
                    Mantener sesión iniciada
                </label>

                <button type="submit" class="btn btn-primary mt-2 w-full py-3 text-base">Ingresar →</button>
            </form>
        </div>
    </div>
@endsection
