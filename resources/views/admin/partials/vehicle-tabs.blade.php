<div class="mb-6 flex flex-wrap gap-2">
    @foreach ($vehicles as $item)
        <a href="{{ route('admin.destinations.index', $item) }}" @class([
            'border px-3 py-1.5 text-sm',
            'border-ruo-600 bg-ruo-600 font-semibold text-white' => $item->is($vehicle),
            'border-neutral-300 text-neutral-600 hover:border-ruo-600 hover:text-ruo-700' => ! $item->is($vehicle),
        ])>{{ $item->name }} · {{ $item->plate }}</a>
    @endforeach
</div>
