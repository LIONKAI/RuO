@extends('layouts.ruo')

@section('page', 'landing')

@section('content')
    @php
        $ctaUrl = auth()->check() ? route('home') : route('login');
        $ctaLabel = auth()->check() ? 'Ir a mi panel' : 'Ingresar';
    @endphp

    <header class="sticky top-0 z-50 flex h-15 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-16">
        <a href="{{ route('landing') }}">@include('partials.logo', ['size' => 26])</a>
        <nav class="flex items-center gap-3 sm:gap-8">
            <a href="#como-funciona" class="hidden text-sm text-neutral-600 hover:text-ruo-700 sm:inline">Cómo funciona</a>
            <a href="#para-quien" class="hidden text-sm text-neutral-600 hover:text-ruo-700 sm:inline">Para quién</a>
            <a href="{{ $ctaUrl }}" class="btn btn-primary px-4 py-1.5 text-[13px]">{{ $ctaLabel }}</a>
        </nav>
    </header>

    {{-- HERO --}}
    <section class="relative overflow-hidden bg-ruo-900 px-4 py-16 sm:px-16 sm:py-28">
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(89,128,166,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(89,128,166,.1)_1px,transparent_1px)] bg-[size:48px_48px]"></div>
        <div class="relative mx-auto max-w-5xl text-center">
            <div class="mb-7 inline-flex items-center gap-2 border border-ruo-500/40 px-3.5 py-1.5 font-display text-[11px] tracking-[0.1em] text-ruo-300 uppercase">
                <span class="live-dot inline-block size-1.5 rounded-full bg-ruo-400"></span>
                Beta disponible · Bolivia
            </div>
            <h1 class="mb-7 font-display text-[clamp(48px,9vw,100px)] leading-[0.92] font-extrabold tracking-tight text-neutral-100 uppercase">
                Rutas óptimas.<br><span class="text-ruo-400">Flota bajo control.</span>
            </h1>
            <p class="mx-auto mb-11 max-w-xl text-base leading-relaxed text-ruo-200 sm:text-lg">
                El administrador carga los destinos del día y RuO genera la ruta más eficiente para cada vehículo.
                El chofer la sigue en tiempo real desde su teléfono.
            </p>
            <div class="mb-16 flex flex-wrap justify-center gap-3.5">
                <a href="{{ $ctaUrl }}" class="btn btn-primary px-8 py-3 text-[15px]">Ver panel admin →</a>
                <a href="{{ $ctaUrl }}" class="btn border-ruo-500/50 bg-transparent px-8 py-3 text-[15px] text-ruo-200 hover:border-ruo-300">Ver vista chofer →</a>
            </div>

            <div class="mx-auto grid max-w-2xl gap-4 text-left sm:grid-cols-[3fr_2fr]">
                <div class="corners border border-ruo-500/25 bg-white/5 p-5" style="--corner-color: var(--color-ruo-500)">
                    <p class="mb-3.5 font-display text-[9px] tracking-[0.1em] text-ruo-400 uppercase">Panel administrador</p>
                    <div class="flex flex-col gap-2.5 text-[11px]">
                        @foreach ([['Vehículo 1 — Carlos M.', '3/6', 50, 'bg-ruo-500', 'text-ruo-300'], ['Vehículo 2 — Juan P.', '5/5 ✓', 100, 'bg-done', 'text-done'], ['Vehículo 3 — Mario R.', '0/4', 0, '', 'text-white/30']] as [$name, $count, $width, $bar, $color])
                            <div>
                                <div class="mb-1 flex justify-between"><span class="text-neutral-100/70">{{ $name }}</span><span class="{{ $color }}">{{ $count }}</span></div>
                                <div class="h-[3px] bg-white/10"><div class="h-full {{ $bar }}" style="width: {{ $width }}%"></div></div>
                            </div>
                        @endforeach
                    </div>
                </div>
                <div class="corners border border-ruo-500/25 bg-white/5 p-5" style="--corner-color: var(--color-ruo-500)">
                    <p class="mb-2.5 font-display text-[9px] tracking-[0.1em] text-ruo-400 uppercase">Chofer</p>
                    <svg viewBox="0 0 120 82" class="block h-14 w-full" aria-hidden="true">
                        <line x1="0" y1="41" x2="120" y2="41" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
                        <line x1="60" y1="0" x2="60" y2="82" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
                        <line x1="30" y1="0" x2="30" y2="82" stroke="rgba(255,255,255,.04)" stroke-width="4"/>
                        <line x1="90" y1="0" x2="90" y2="82" stroke="rgba(255,255,255,.04)" stroke-width="4"/>
                        <polyline points="15,68 15,41 60,41 60,20 90,20 90,41" fill="none" stroke="#7298bd" stroke-width="2" stroke-dasharray="6,3"/>
                        <circle cx="60" cy="20" r="4" fill="white" stroke="#7298bd" stroke-width="1.5"/>
                        <circle cx="90" cy="41" r="4" fill="#e67e22"/>
                        <circle cx="15" cy="41" r="5" fill="#7298bd"/>
                        <circle cx="15" cy="41" r="2" fill="white"/>
                    </svg>
                    <p class="mt-1.5 text-[10px] text-neutral-100/40">3 → Av. Busch 890</p>
                </div>
            </div>
        </div>
    </section>

    {{-- PROBLEMA --}}
    <section class="px-4 py-16 sm:px-16 sm:py-24">
        <div class="mx-auto max-w-6xl">
            <p class="eyebrow mb-3 text-ruo-600">01 — El problema</p>
            <h2 class="mb-12 font-display text-[clamp(34px,5vw,56px)] leading-none font-extrabold uppercase">Coordinar por WhatsApp<br>no es gestión de flota.</h2>
            <div class="grid gap-4 md:grid-cols-3">
                @foreach ([
                    ['01', 'Rutas sin orden', 'El chofer decide el orden por intuición. Genera kilómetros extra, combustible desperdiciado y entregas tardías.'],
                    ['02', 'Cero visibilidad', 'El administrador no sabe dónde está cada vehículo ni cuántos destinos faltan hasta que el chofer manda un mensaje.'],
                    ['03', 'Excel manual', 'Km y combustible se calculan a mano al final del día. Errores frecuentes, datos tardíos, ningún control real.'],
                ] as [$number, $title, $text])
                    <div class="corners border border-neutral-200 p-6">
                        <p class="mb-4 font-display text-4xl font-extrabold text-ruo-200">{{ $number }}</p>
                        <h3 class="mb-2 font-display text-xl font-bold uppercase">{{ $title }}</h3>
                        <p class="text-sm leading-relaxed text-neutral-600">{{ $text }}</p>
                    </div>
                @endforeach
            </div>
        </div>
    </section>

    {{-- CÓMO FUNCIONA --}}
    <section id="como-funciona" class="scroll-mt-16 bg-ruo-50 px-4 py-16 sm:px-16 sm:py-24">
        <div class="mx-auto max-w-6xl">
            <p class="eyebrow mb-3 text-ruo-600">02 — Cómo funciona</p>
            <h2 class="mb-12 font-display text-[clamp(34px,5vw,56px)] leading-none font-extrabold uppercase">Tres pasos.<br>Todo el día resuelto.</h2>
            <div class="grid gap-4 md:grid-cols-3">
                @foreach ([
                    ['Administrador', '1', 'Carga destinos', 'Ingresa las direcciones del día para cada vehículo. RuO calcula la ruta óptima automáticamente.'],
                    ['Chofer', '2', 'Sigue la ruta', 'Ve la ruta paso a paso en su teléfono y marca cada destino como completado al llegar.'],
                    ['Sistema', '3', 'Control total', 'Destino imprevisto → ruta recalculada en tiempo real. Km y combustible calculados solos al finalizar.'],
                ] as [$who, $number, $title, $text])
                    <div class="corners corners-accent border border-ruo-200 bg-white p-6">
                        <div class="mb-5 flex items-center justify-between">
                            <span class="tag tag-outline">{{ $who }}</span>
                            <span class="flex size-9 items-center justify-center bg-ruo-600 font-display text-lg font-bold text-white">{{ $number }}</span>
                        </div>
                        <h3 class="mb-2 font-display text-xl font-bold uppercase">{{ $title }}</h3>
                        <p class="text-sm leading-relaxed text-neutral-600">{{ $text }}</p>
                    </div>
                @endforeach
            </div>
        </div>
    </section>

    {{-- PARA QUIÉN --}}
    <section id="para-quien" class="scroll-mt-16 px-4 py-16 sm:px-16 sm:py-24">
        <div class="mx-auto max-w-6xl">
            <p class="eyebrow mb-3 text-ruo-600">03 — Para quién</p>
            <div class="grid gap-4 md:grid-cols-2">
                @foreach ([
                    ['Administrador', 'Tú mandas<br>la flota.', ['Carga destinos del día por vehículo', 'Panel en tiempo real con todos los vehículos', 'Agrega imprevistos — ruta recalculada al instante', 'Resumen de km y combustible al cierre del día'], 'Ver panel admin →', true],
                    ['Chofer', 'Tú sigues<br>la ruta.', ['Ruta optimizada del día en tu teléfono', 'Marca destinos como completados al llegar', 'Ruta actualizada automáticamente si hay cambios', 'Resumen de jornada al finalizar'], 'Ver vista chofer →', false],
                ] as [$who, $title, $items, $cta, $dark])
                    <div @class(['corners p-8', 'bg-ruo-900 text-neutral-100' => $dark, 'border border-neutral-200' => ! $dark]) style="--corner-color: {{ $dark ? 'var(--color-ruo-500)' : 'var(--color-neutral-400)' }}">
                        <p @class(['eyebrow mb-3', 'text-ruo-300' => $dark])>{{ $who }}</p>
                        <h3 class="mb-6 font-display text-4xl leading-none font-extrabold uppercase">{!! $title !!}</h3>
                        <ul class="mb-8 flex flex-col gap-3">
                            @foreach ($items as $item)
                                <li class="flex gap-3 text-sm"><span @class(['text-ruo-400' => $dark, 'text-ruo-600' => ! $dark])>→</span><span @class(['text-ruo-100' => $dark, 'text-neutral-700' => ! $dark])>{{ $item }}</span></li>
                            @endforeach
                        </ul>
                        <a href="{{ $ctaUrl }}" @class(['btn', 'btn-primary' => $dark, 'btn-secondary' => ! $dark])>{{ $cta }}</a>
                    </div>
                @endforeach
            </div>
        </div>
    </section>

    {{-- CTA --}}
    <section class="bg-ruo-600 px-4 py-16 text-center text-white sm:px-16">
        <h2 class="mb-3 font-display text-[clamp(34px,5vw,56px)] leading-none font-extrabold uppercase">¿Listo para optimizar?</h2>
        <p class="mb-8 text-ruo-100">Para flotas de 2 a 5 vehículos. Hecho para Bolivia.</p>
        <a href="{{ $ctaUrl }}" class="btn border-white bg-white px-8 py-3 text-[15px] text-ruo-800 hover:bg-ruo-50">Comenzar ahora →</a>
    </section>

    <footer class="flex flex-col items-center justify-between gap-3 border-t border-neutral-200 px-4 py-6 text-xs text-neutral-500 sm:flex-row sm:px-16">
        @include('partials.logo', ['size' => 18])
        <span>© {{ now()->year }} RuO · Ruta Óptima · Bolivia</span>
    </footer>
@endsection
