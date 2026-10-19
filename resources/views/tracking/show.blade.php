@extends('layouts.ruo')

@section('title', 'Sigue tu entrega')
@section('page', 'tracking')

@include('partials.leaflet')

@section('content')
    <div class="mx-auto flex min-h-screen max-w-xl flex-col bg-white sm:border-x sm:border-neutral-200">
        <header class="flex h-14 items-center justify-between bg-ruo-900 px-4 text-white">
            <span class="font-display text-xl leading-none font-extrabold">Ru<span class="text-ruo-300">O</span></span>
            <span class="flex items-center gap-2 text-[11px] text-ruo-200">
                <span class="live-dot inline-block size-2 rounded-full bg-done"></span> En vivo
            </span>
        </header>

        <main class="flex flex-1 flex-col">
            <div class="map-box h-[38vh] min-h-[240px]" data-map></div>

            <section class="px-5 py-5">
                <p class="eyebrow mb-1" data-field-label>Tu entrega</p>
                <h1 class="font-display text-2xl font-bold uppercase" data-field="reference">—</h1>
                <p class="mb-4 text-sm text-neutral-500" data-field="address">—</p>

                <div class="mb-4 flex items-center gap-3">
                    <span class="tag tag-accent" data-field="status_label">—</span>
                    <span class="text-xs text-neutral-400" data-field="service_date"></span>
                </div>

                <p class="border-l-4 border-l-ruo-600 bg-ruo-50 px-4 py-3 text-sm" data-field="message">—</p>

                <div class="mt-4 grid grid-cols-2 gap-3" data-eta-block>
                    <div class="corners border border-neutral-200 px-4 py-3 text-center">
                        <p class="eyebrow mb-1">Paradas antes de ti</p>
                        <p class="font-display text-3xl leading-none font-extrabold text-ruo-700" data-field="queue_position">—</p>
                    </div>
                    <div class="corners border border-neutral-200 px-4 py-3 text-center">
                        <p class="eyebrow mb-1">Llegada estimada</p>
                        <p class="font-display text-3xl leading-none font-extrabold text-ruo-700"><span data-field="eta_minutes">—</span><span class="text-sm font-normal text-neutral-500"> min</span></p>
                    </div>
                </div>

                <p class="mt-4 text-xs text-neutral-400" data-field="vehicle_line"></p>
            </section>
        </main>

        <footer class="border-t border-neutral-100 px-5 py-4 text-center text-[11px] text-neutral-400">
            Seguimiento en tiempo real · RuO Ruta Óptima
        </footer>
    </div>

    @php
        $trackingConfig = [
            'url' => route('tracking.state', $token),
            'center' => [config('services.map.center_latitude'), config('services.map.center_longitude')],
        ];
    @endphp
    <script type="application/json" id="initial-state">@json($initialState)</script>
    <script type="application/json" id="state-config">@json($trackingConfig)</script>
@endsection
