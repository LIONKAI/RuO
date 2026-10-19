{{-- Ordered list of a workday's destinations. Expects $workday. --}}
<ol class="divide-y divide-neutral-100 border border-neutral-200">
    @forelse ($workday->destinations as $destination)
        <li @class([
            'flex items-center gap-3 px-4 py-3',
            'bg-neutral-50' => $destination->isCompleted(),
            'bg-alert-50/50' => $destination->isFailed(),
            'border-l-4 border-l-alert' => $destination->is_unplanned,
        ])>
            <span @class([
                'flex size-7 shrink-0 items-center justify-center font-display text-sm font-bold',
                'bg-done text-white' => $destination->isCompleted(),
                'bg-alert text-white' => $destination->isFailed() || ($destination->isPending() && $destination->is_unplanned),
                'bg-ruo-600 text-white' => $destination->isPending() && ! $destination->is_unplanned && $destination->position,
                'border border-neutral-300 text-neutral-400' => ! $destination->position && ! $destination->is_unplanned && ! $destination->isCompleted() && ! $destination->isFailed(),
            ])>{{ $destination->isCompleted() ? '✓' : ($destination->isFailed() ? '✕' : ($destination->position ?? $loop->iteration)) }}</span>
            <div class="min-w-0 flex-1">
                <p @class(['truncate text-sm font-semibold', 'text-neutral-400 line-through' => $destination->isCompleted(), 'text-alert' => $destination->isFailed()])>{{ $destination->reference }}</p>
                <p class="truncate text-xs text-neutral-500">{{ $destination->address }}</p>
                @if ($destination->isFailed())
                    <p class="text-xs text-alert">{{ $destination->failure_reason }}</p>
                @elseif ($destination->isCompleted() && $destination->recipient_name)
                    <p class="text-xs text-neutral-400">Recibió: {{ $destination->recipient_name }}</p>
                @endif
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                @if ($destination->is_unplanned)
                    <span class="tag tag-alert">Imprevisto</span>
                @endif
                @if ($destination->isCompleted())
                    <span class="tag tag-done">Completado</span>
                    @if ($destination->pod_photo_path)
                        <a href="{{ Storage::disk('public')->url($destination->pod_photo_path) }}" target="_blank" rel="noopener" class="tag tag-outline" title="Foto de entrega">📷</a>
                    @endif
                    @if ($destination->pod_signature_path)
                        <a href="{{ Storage::disk('public')->url($destination->pod_signature_path) }}" target="_blank" rel="noopener" class="tag tag-outline" title="Firma">✍</a>
                    @endif
                @elseif ($destination->isFailed())
                    <form method="POST" action="{{ route('admin.destinations.requeue', $destination) }}" class="flex items-center gap-1.5">
                        @csrf
                        <input type="date" name="fecha" value="{{ today()->addDay()->toDateString() }}" min="{{ today()->toDateString() }}" required class="input w-auto px-1.5 py-1 text-xs" aria-label="Reagendar para">
                        <button type="submit" class="btn btn-secondary px-2 py-1 text-xs">Reagendar</button>
                    </form>
                @elseif ($workday->isDraft())
                    <a href="{{ $destination->trackingUrl() }}" target="_blank" rel="noopener" class="tag tag-outline" title="Link de seguimiento">🔗</a>
                    @if ($destination->phone)
                        <a href="{{ app(\App\Services\WhatsApp::class)->trackingLink($destination) }}" target="_blank" rel="noopener" class="tag tag-done" title="Avisar por WhatsApp">WhatsApp</a>
                    @endif
                    <form method="POST" action="{{ route('admin.destinations.destroy', ['destination' => $destination, 'fecha' => $workday->date->toDateString()]) }}">
                        @csrf
                        @method('DELETE')
                        <button type="submit" class="btn btn-ghost px-2 py-1 text-xs" aria-label="Eliminar {{ $destination->reference }}">Eliminar</button>
                    </form>
                @else
                    <a href="{{ $destination->trackingUrl() }}" target="_blank" rel="noopener" class="tag tag-outline" title="Link de seguimiento">🔗</a>
                    @if ($destination->phone)
                        <a href="{{ app(\App\Services\WhatsApp::class)->trackingLink($destination) }}" target="_blank" rel="noopener" class="tag tag-done" title="Avisar por WhatsApp">WhatsApp</a>
                    @endif
                    <span class="tag tag-outline">Pendiente</span>
                @endif
            </div>
        </li>
    @empty
        <li class="px-4 py-8 text-center text-sm text-neutral-500">Todavía no hay destinos cargados para esta fecha.</li>
    @endforelse
</ol>
