@extends('layouts.ruo')

@section('content')
    <div class="mx-auto flex min-h-screen max-w-xl flex-col bg-white sm:border-x sm:border-neutral-200">
        <header class="sticky top-0 z-50 flex h-14 items-center justify-between bg-ruo-900 px-4 text-white">
            <a href="{{ route('driver.route') }}" class="font-display text-xl leading-none font-extrabold">Ru<span class="text-ruo-300">O</span></a>
            <div class="flex items-center gap-3 text-right">
                <div class="leading-tight">
                    <p class="text-sm font-semibold">{{ auth()->user()->name }}</p>
                    <p class="text-[11px] text-ruo-200">{{ auth()->user()->vehicle?->name ?? 'Sin vehículo' }} @if (auth()->user()->vehicle) · {{ auth()->user()->vehicle->plate }} @endif</p>
                </div>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="border border-ruo-700 px-2.5 py-1.5 text-xs text-ruo-200 hover:text-white">Salir</button>
                </form>
            </div>
        </header>
        <main class="flex flex-1 flex-col">
            @yield('main')
        </main>
    </div>
    <div class="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
        <div class="pointer-events-auto hidden items-center gap-2 border border-alert bg-white px-4 py-2.5 text-sm font-semibold text-alert shadow-lg" data-toast></div>
    </div>
@endsection
