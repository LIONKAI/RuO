{{-- Ordered list of a workday's destinations. Expects $workday. --}}
<ol class="divide-y divide-neutral-100 border border-neutral-200">
    @forelse ($workday->destinations as $destination)
        <li @class([
            'flex items-center gap-3 px-4 py-3',
            'bg-neutral-50' => $destination->isCompleted(),
            'border-l-4 border-l-alert' => $destination->is_unplanned,
        ])>
            <span @class([
                'flex size-7 shrink-0 items-center justify-center font-display text-sm font-bold',
                'bg-done text-white' => $destination->isCompleted(),
                'bg-alert text-white' => $destination->isPending() && $destination->is_unplanned,
                'bg-ruo-600 text-white' => $destination->isPending() && ! $destination->is_unplanned && $destination->position,
                'border border-neutral-300 text-neutral-400' => ! $destination->position && ! $destination->is_unplanned,
            ])>{{ $destination->isCompleted() ? '✓' : ($destination->position ?? $loop->iteration) }}</span>
            <div class="min-w-0 flex-1">
                <p @class(['truncate text-sm font-semibold', 'text-neutral-400 line-through' => $destination->isCompleted()])>{{ $destination->reference }}</p>
                <p class="truncate text-xs text-neutral-500">{{ $destination->address }}</p>
            </div>
            @if ($destination->is_unplanned)
                <span class="tag tag-alert">Imprevisto</span>
            @endif
            @if ($destination->isCompleted())
                <span class="tag tag-done">Completado</span>
            @elseif ($workday->isDraft())
                <form method="POST" action="{{ route('admin.destinations.destroy', $destination) }}">
                    @csrf
                    @method('DELETE')
                    <button type="submit" class="btn btn-ghost px-2 py-1 text-xs" aria-label="Eliminar {{ $destination->reference }}">Eliminar</button>
                </form>
            @else
                <span class="tag tag-outline">Pendiente</span>
            @endif
        </li>
    @empty
        <li class="px-4 py-8 text-center text-sm text-neutral-500">Todavía no hay destinos cargados para hoy.</li>
    @endforelse
</ol>
