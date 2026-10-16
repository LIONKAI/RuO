{{-- Destination form with map picker. Expects $action, $submitLabel and optional $unplanned. --}}
<form method="POST" action="{{ $action }}" class="flex flex-col gap-4" data-destination-form>
    @csrf
    <div>
        <label for="address" class="label">Dirección</label>
        <div class="flex gap-2">
            <input id="address" name="address" value="{{ old('address') }}" required maxlength="255" autocomplete="off"
                placeholder="Ej: Av. Cañoto 450" @class(['input', 'border-alert' => $errors->has('address')]) data-address>
            <button type="button" class="btn btn-secondary shrink-0" data-geocode>Buscar</button>
        </div>
        @error('address')
            <p class="mt-1.5 text-sm text-alert">{{ $message }}</p>
        @enderror
        <p class="mt-1.5 text-xs text-neutral-500" data-geocode-status>Busca la dirección o haz clic en el mapa para marcar el punto exacto.</p>
    </div>
    <div>
        <label for="reference" class="label">Referencia o nombre del punto</label>
        <input id="reference" name="reference" value="{{ old('reference') }}" required maxlength="120" autocomplete="off"
            placeholder="Ej: Ferretería El Constructor" @class(['input', 'border-alert' => $errors->has('reference')])>
        @error('reference')
            <p class="mt-1.5 text-sm text-alert">{{ $message }}</p>
        @enderror
    </div>
    <input type="hidden" name="latitude" value="{{ old('latitude') }}" data-latitude>
    <input type="hidden" name="longitude" value="{{ old('longitude') }}" data-longitude>
    @error('latitude')
        <p class="text-sm text-alert">{{ $message }}</p>
    @enderror
    <button type="submit" @class(['btn w-full py-3', 'btn-alert' => $unplanned ?? false, 'btn-primary' => ! ($unplanned ?? false)])>{{ $submitLabel }}</button>
</form>
