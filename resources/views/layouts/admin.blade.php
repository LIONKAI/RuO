@extends('layouts.ruo')

@section('content')
    @php
        $tabs = [
            ['label' => 'Panel', 'url' => route('admin.dashboard'), 'active' => request()->routeIs('admin.dashboard')],
            ['label' => 'Destinos', 'url' => route('admin.destinations.start'), 'active' => request()->routeIs('admin.destinations.*', 'admin.unplanned.*')],
            ['label' => 'Resumen', 'url' => route('admin.summary'), 'active' => request()->routeIs('admin.summary')],
        ];
    @endphp
    <header class="sticky top-0 z-50 border-b border-neutral-200 bg-white">
        <div class="flex h-14 items-center justify-between px-4 sm:px-8">
            <div class="flex h-full items-center">
                <a href="{{ route('admin.dashboard') }}" class="mr-4 sm:mr-6">@include('partials.logo', ['size' => 22])</a>
                <nav class="flex h-full">
                    @foreach ($tabs as $tab)
                        <a href="{{ $tab['url'] }}" @class([
                            'flex h-full items-center border-b-2 px-3 text-sm sm:px-4',
                            'border-ruo-600 bg-ruo-50 font-semibold text-ruo-700' => $tab['active'],
                            'border-transparent text-neutral-500 hover:text-ruo-700' => ! $tab['active'],
                        ])>{{ $tab['label'] }}</a>
                    @endforeach
                </nav>
            </div>
            <div class="flex items-center gap-4">
                <span class="hidden text-sm text-neutral-400 md:inline">Admin · {{ auth()->user()->name }}</span>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="text-xs text-neutral-400 hover:text-ruo-700">Salir</button>
                </form>
            </div>
        </div>
    </header>
    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        @include('partials.flash')
        @yield('main')
    </main>
@endsection
