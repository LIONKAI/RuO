/**
 * RuO front-end: live screens for the admin, the driver and the public
 * tracking page. Leaflet is loaded from a CDN only on pages that show a map
 * (window.L).
 */

const POLL_INTERVAL_MS = 3000;
const POSITION_MIN_INTERVAL_MS = 20000;

const COLORS = {
    accent: '#2f6496',
    navy: '#1e3a5f',
    done: '#27ae60',
    alert: '#e67e22',
    failed: '#c0392b',
    muted: '#a3a3a3',
};

const FLEET_COLORS = ['#2f6496', '#e67e22', '#8e44ad', '#16a085', '#c0392b', '#2c3e50'];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function readJson(id) {
    const element = document.getElementById(id);

    return element ? JSON.parse(element.textContent) : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers ?? {}),
        },
    });

    if (response.status === 401 || response.status === 419) {
        window.location.reload();

        throw new Error('Sesión expirada');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.message ?? 'Error del servidor');
        error.status = response.status;
        throw error;
    }

    return data;
}

/**
 * POST a multipart form (photo + signature uploads) as JSON-accepting fetch.
 */
async function postForm(url, formData) {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(Object.values(data.errors ?? {})[0]?.[0] ?? data.message ?? 'Error del servidor');
        error.status = response.status;
        throw error;
    }

    return data;
}

/**
 * Poll a URL every few seconds while the tab is visible.
 */
function poll(url, onData, onError = () => {}) {
    let timer = null;
    let running = false;

    const tick = async () => {
        if (running || document.hidden) {
            return;
        }

        running = true;

        try {
            onData(await fetchJson(url));
        } catch (error) {
            onError(error);
        } finally {
            running = false;
        }
    };

    timer = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            tick();
        }
    });

    return {
        now: tick,
        stop: () => clearInterval(timer),
    };
}

function formatNumber(value, decimals = 1) {
    return Number(value ?? 0).toLocaleString('es-BO', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatDistance(meters) {
    return meters >= 1000 ? `${formatNumber(meters / 1000, 1)} km` : `${Math.round(meters)} m`;
}

let toastTimer = null;

function showToast(message) {
    const toast = document.querySelector('[data-toast]');

    if (!toast) {
        return;
    }

    toast.innerHTML = `<span aria-hidden="true">⟳</span> ${escapeHtml(message)}`;
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
    }, 4500);
}

/* ------------------------------------------------------------------ */
/* Maps                                                                 */
/* ------------------------------------------------------------------ */

function createMap(element, center) {
    if (!element || !window.L) {
        return null;
    }

    const map = window.L.map(element, { zoomControl: true, scrollWheelZoom: true }).setView(center, 13);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    return map;
}

function stopIcon(label, color, { size = 26, ring = false } = {}) {
    return window.L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div class="stop-marker" style="width:${size}px;height:${size}px;background:${color};${ring ? `box-shadow:0 0 0 4px ${color}55;` : ''}">${escapeHtml(label)}</div>`,
    });
}

function depotIcon() {
    return window.L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: '<div class="stop-marker" style="width:30px;height:30px;background:#1e3a5f;font-size:15px;">⌂</div>',
    });
}

function vehicleIcon(color = COLORS.accent) {
    return window.L.divIcon({
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 3px ${color}66,0 1px 4px #0004;"></div>`,
    });
}

function drawDepot(layer, depot, label = 'Base') {
    if (!depot) {
        return;
    }

    window.L.marker([depot.latitude, depot.longitude], { icon: depotIcon(), zIndexOffset: 500 })
        .bindPopup(`<strong>${escapeHtml(label)}</strong>${depot.address ? `<br>${escapeHtml(depot.address)}` : ''}`)
        .addTo(layer);
}

function drawPosition(layer, position, label = 'Chofer') {
    if (!position) {
        return;
    }

    window.L.marker([position.latitude, position.longitude], { icon: vehicleIcon(), zIndexOffset: 1500 })
        .bindPopup(`<strong>${escapeHtml(label)}</strong>`)
        .addTo(layer);
}

/**
 * Draws the destinations and route legs of a workday. Returns a layer group.
 */
function drawRoute(map, route, { focusActive = false } = {}) {
    const layer = window.L.layerGroup().addTo(map);

    drawDepot(layer, route?.vehicle?.depot, `Base · ${route?.vehicle?.name ?? ''}`);

    if (!route || !route.destinations?.length) {
        return layer;
    }

    const bounds = [];
    const ordered = route.destinations.some((destination) => destination.position);

    route.destinations.forEach((destination, index) => {
        const isDone = destination.status === 'completed';
        const isFailed = destination.status === 'failed';
        const isActive = destination.id === route.active_id;

        if (destination.geometry?.length > 1) {
            window.L.polyline(destination.geometry, {
                color: isDone ? COLORS.done : isFailed ? COLORS.failed : isActive ? COLORS.accent : COLORS.navy,
                weight: isActive ? 6 : 4,
                opacity: isDone || isFailed ? 0.55 : 0.85,
                dashArray: isDone || isFailed ? '6 8' : null,
            }).addTo(layer);

            if (!focusActive || isActive) {
                bounds.push(...destination.geometry);
            }
        }

        let color = ordered ? COLORS.navy : COLORS.muted;

        if (isDone) {
            color = COLORS.done;
        } else if (isFailed) {
            color = COLORS.failed;
        } else if (destination.is_unplanned) {
            color = COLORS.alert;
        } else if (isActive) {
            color = COLORS.accent;
        }

        const label = isDone ? '✓' : isFailed ? '✕' : destination.position ?? index + 1;

        window.L.marker([destination.latitude, destination.longitude], {
            icon: stopIcon(label, color, { size: isActive ? 32 : 26, ring: isActive }),
            zIndexOffset: isActive ? 1000 : 0,
        })
            .bindPopup(`<strong>${escapeHtml(destination.reference)}</strong><br>${escapeHtml(destination.address)}`)
            .addTo(layer);

        if (!focusActive || isActive) {
            bounds.push([destination.latitude, destination.longitude]);
        }
    });

    if (route.vehicle?.depot) {
        bounds.push([route.vehicle.depot.latitude, route.vehicle.depot.longitude]);
    }

    if (bounds.length === 1) {
        map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    }

    return layer;
}

/**
 * Shared map picker: geocode search + click/drag marker binding the
 * [data-address], [data-latitude] and [data-longitude] fields of a
 * [data-destination-form] form.
 */
function attachPicker(map, config) {
    const form = document.querySelector('[data-destination-form]');

    if (!form || !config.picker) {
        return;
    }

    const latitudeInput = form.querySelector('[data-latitude]');
    const longitudeInput = form.querySelector('[data-longitude]');
    const addressInput = form.querySelector('[data-address]');
    const status = form.querySelector('[data-geocode-status]');
    const geocodeButton = form.querySelector('[data-geocode]');
    let marker = null;

    const setPoint = (latitude, longitude, message, pan = true) => {
        latitudeInput.value = Number(latitude).toFixed(7);
        longitudeInput.value = Number(longitude).toFixed(7);

        const icon = stopIcon('+', COLORS.alert, { size: 30, ring: true });

        if (marker) {
            marker.setLatLng([latitude, longitude]);
        } else {
            marker = window.L.marker([latitude, longitude], { icon, draggable: true, zIndexOffset: 2000 }).addTo(map);
            marker.on('dragend', () => {
                const position = marker.getLatLng();
                setPoint(position.lat, position.lng, 'Punto ajustado manualmente.', false);
            });
        }

        if (pan) {
            map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
        }

        status.textContent = message;
        status.className = 'mt-1.5 text-xs text-done';
    };

    if (latitudeInput.value && longitudeInput.value) {
        setPoint(latitudeInput.value, longitudeInput.value, 'Punto marcado en el mapa.');
    }

    map.on('click', (event) => setPoint(event.latlng.lat, event.latlng.lng, 'Punto marcado en el mapa. Puedes arrastrarlo para ajustarlo.', false));

    addressInput.addEventListener('input', () => {
        latitudeInput.value = '';
        longitudeInput.value = '';
        marker?.remove();
        marker = null;
        status.textContent = 'Busca la dirección o haz clic en el mapa para marcar el punto exacto.';
        status.className = 'mt-1.5 text-xs text-neutral-500';
    });

    geocodeButton.addEventListener('click', async () => {
        const address = addressInput.value.trim();

        if (!address) {
            addressInput.focus();

            return;
        }

        geocodeButton.disabled = true;
        status.textContent = 'Buscando dirección…';
        status.className = 'mt-1.5 text-xs text-neutral-500';

        try {
            const url = new URL(config.geocodeUrl, window.location.origin);
            url.searchParams.set('address', address);
            const location = await fetchJson(url);
            setPoint(location.latitude, location.longitude, `Encontrado: ${location.label}. Si no es exacto, arrastra el punto.`);
        } catch (error) {
            status.textContent = error.message;
            status.className = 'mt-1.5 text-xs text-alert';
        } finally {
            geocodeButton.disabled = false;
        }
    });

    form.addEventListener('submit', () => {
        form.querySelector('button[type="submit"]').disabled = true;
    });
}

/* ------------------------------------------------------------------ */
/* Admin: live dashboard + fleet map                                    */
/* ------------------------------------------------------------------ */

function adminDashboard() {
    const config = readJson('state-config');
    const statsEl = document.querySelector('[data-stats]');
    const vehiclesEl = document.querySelector('[data-vehicles]');
    const updatedEl = document.querySelector('[data-updated-at]');
    const errorEl = document.querySelector('[data-connection-error]');
    const fleetMap = adminFleetMap(config);

    const stat = (label, value, hint, accent = false) => `
        <div class="corners border border-neutral-200 px-5 py-4">
            <p class="eyebrow mb-1.5 text-[9px]">${label}</p>
            <p class="font-display text-4xl leading-none font-extrabold ${accent ? 'text-ruo-600' : ''}">${value}</p>
            <p class="mt-1 text-[11px] text-neutral-400">${hint}</p>
        </div>`;

    const card = (vehicle) => {
        const percent = vehicle.total ? Math.round((vehicle.completed / vehicle.total) * 100) : 0;
        const inProgress = vehicle.status === 'in_progress';
        const completed = vehicle.status === 'completed';
        const tag = completed ? 'tag-done' : inProgress ? 'tag-accent' : 'tag-outline';

        const current = vehicle.active
            ? `<div class="mb-3 border ${vehicle.active.is_unplanned ? 'border-alert' : 'border-ruo-200'} bg-white px-3 py-2.5">
                   <p class="eyebrow mb-0.5 text-[9px] ${vehicle.active.is_unplanned ? 'text-alert' : 'text-ruo-600'}">Destino actual${vehicle.active.is_unplanned ? ' · imprevisto' : ''}</p>
                   <p class="text-sm font-semibold">${escapeHtml(vehicle.active.reference)}</p>
                   <p class="text-xs text-neutral-500">${escapeHtml(vehicle.active.address)}</p>
               </div>`
            : completed
              ? `<div class="mb-3 border border-done bg-done-50 px-3 py-2.5 text-sm font-semibold text-done">Ruta completada ✓</div>`
              : `<div class="mb-3 border border-dashed border-neutral-300 px-3 py-2.5 text-sm text-neutral-500">${vehicle.total ? `${vehicle.total} destino(s) cargado(s). Falta generar la ruta.` : 'Sin destinos cargados para hoy.'}</div>`;

        const failed = vehicle.failed ? `<span class="text-alert">${vehicle.failed} fallido(s)</span> · ` : '';

        return `
            <article class="corners ${inProgress ? 'corners-accent border-ruo-300 bg-ruo-50' : 'border-neutral-200 bg-white'} border p-5">
                <div class="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h3 class="font-display text-lg font-bold uppercase">${escapeHtml(vehicle.name)}</h3>
                        <p class="text-sm text-neutral-600">${escapeHtml(vehicle.driver)} · ${escapeHtml(vehicle.plate)}</p>
                    </div>
                    <span class="tag ${tag}">${escapeHtml(vehicle.status_label)}</span>
                </div>
                <div class="mb-3">
                    <div class="mb-1 flex justify-between text-xs text-neutral-500">
                        <span>Progreso</span>
                        <span class="font-semibold text-ruo-700" data-progress-label>${failed}${vehicle.completed} de ${vehicle.total} completados</span>
                    </div>
                    <div class="h-1 bg-ruo-200"><div class="h-full ${completed ? 'bg-done' : 'bg-ruo-600'} transition-all" style="width:${percent}%"></div></div>
                </div>
                ${current}
                <div class="mb-3 flex justify-between text-xs text-neutral-500">
                    <span>${formatNumber(vehicle.driven_km)} km recorridos</span>
                    <span>${formatNumber(vehicle.driven_fuel, 2)} L estimados</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="${vehicle.urls.destinations}" class="btn btn-secondary px-3 py-1.5 text-xs">${vehicle.status === 'draft' ? 'Cargar destinos' : 'Ver ruta'}</a>
                    ${vehicle.status !== 'draft' ? `<a href="${vehicle.urls.unplanned}" class="btn btn-alert px-3 py-1.5 text-xs">+ Destino imprevisto</a>` : ''}
                </div>
            </article>`;
    };

    const render = (state) => {
        const stats = state.stats;

        statsEl.innerHTML = [
            stat('Vehículos en ruta', stats.active_vehicles, `de ${stats.total_vehicles} totales`, true),
            stat('Destinos completados', stats.completed_destinations, `de ${stats.total_destinations} totales`),
            stat('Km recorridos', formatNumber(stats.driven_km), 'km hoy'),
            stat('Combustible est.', formatNumber(stats.driven_fuel), 'litros'),
        ].join('');

        vehiclesEl.innerHTML = state.vehicles.length
            ? state.vehicles.map(card).join('')
            : '<p class="text-sm text-neutral-500">No hay vehículos registrados.</p>';

        updatedEl.textContent = `· actualizado ${state.updated_at}`;
        fleetMap?.update(state.vehicles);
    };

    render(readJson('initial-state'));

    poll(
        config.url,
        (state) => {
            errorEl.classList.add('hidden');
            render(state);
        },
        () => errorEl.classList.remove('hidden'),
    );
}

/**
 * Live map of the whole fleet on the dashboard: depots, route legs,
 * stops and each driver's last reported GPS position.
 */
function adminFleetMap(config) {
    const element = document.querySelector('[data-fleet-map]');
    const map = createMap(element, config.center);

    if (!map) {
        return null;
    }

    let layer = null;

    return {
        update(vehicles) {
            const drawable = vehicles.filter((vehicle) => vehicle.map);

            element.classList.toggle('hidden', drawable.length === 0);

            if (drawable.length === 0) {
                return;
            }

            layer?.remove();
            layer = window.L.layerGroup().addTo(map);

            const bounds = [];

            drawable.forEach((vehicle, index) => {
                const color = FLEET_COLORS[index % FLEET_COLORS.length];
                const { depot, position, destinations = [] } = vehicle.map;

                if (depot) {
                    window.L.marker([depot.latitude, depot.longitude], { icon: depotIcon(), zIndexOffset: 300 })
                        .bindPopup(`<strong>Base · ${escapeHtml(vehicle.name)}</strong>`)
                        .addTo(layer);
                    bounds.push([depot.latitude, depot.longitude]);
                }

                destinations.forEach((destination) => {
                    const isDone = destination.status === 'completed';
                    const isFailed = destination.status === 'failed';

                    if (destination.geometry?.length > 1) {
                        window.L.polyline(destination.geometry, {
                            color: isDone || isFailed ? '#b6c3d1' : color,
                            weight: 3.5,
                            opacity: isDone || isFailed ? 0.5 : 0.8,
                            dashArray: isDone || isFailed ? '5 7' : null,
                        }).addTo(layer);
                        bounds.push(...destination.geometry);
                    }

                    const dotColor = isDone ? COLORS.done : isFailed ? COLORS.failed : color;
                    window.L.marker([destination.latitude, destination.longitude], {
                        icon: stopIcon(destination.position ?? '', dotColor, { size: 18 }),
                    })
                        .bindPopup(`<strong>${escapeHtml(destination.reference)}</strong><br>${escapeHtml(vehicle.name)}`)
                        .addTo(layer);
                    bounds.push([destination.latitude, destination.longitude]);
                });

                if (position) {
                    window.L.marker([position.latitude, position.longitude], { icon: vehicleIcon(color), zIndexOffset: 1500 })
                        .bindPopup(`<strong>${escapeHtml(vehicle.driver)}</strong><br>${escapeHtml(vehicle.name)} · ${escapeHtml(vehicle.plate)}`)
                        .addTo(layer);
                    bounds.push([position.latitude, position.longitude]);
                }
            });

            if (bounds.length > 1) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
            }
        },
    };
}

/* ------------------------------------------------------------------ */
/* Admin: load destinations / unplanned destination                     */
/* ------------------------------------------------------------------ */

function adminDestinationMap() {
    const config = readJson('map-config');
    const route = readJson('route-data');
    const map = createMap(document.querySelector('[data-map]'), config.center);

    if (!map) {
        return;
    }

    drawRoute(map, route);
    attachPicker(map, config);

    document.querySelector('[data-generate-route]')?.addEventListener('submit', (event) => {
        const button = event.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Calculando ruta óptima…';
    });
}

/* ------------------------------------------------------------------ */
/* Admin: delivery pool (waiting to be split among the fleet)           */
/* ------------------------------------------------------------------ */

function adminPool() {
    const config = readJson('map-config');
    const data = readJson('pool-data') ?? { depots: [], destinations: [] };
    const map = createMap(document.querySelector('[data-map]'), config.center);

    if (!map) {
        return;
    }

    const layer = window.L.layerGroup().addTo(map);
    const bounds = [];

    data.depots.forEach((depot) => {
        window.L.marker([depot.latitude, depot.longitude], { icon: depotIcon(), zIndexOffset: 300 })
            .bindPopup(`<strong>Base · ${escapeHtml(depot.name)}</strong>`)
            .addTo(layer);
        bounds.push([depot.latitude, depot.longitude]);
    });

    data.destinations.forEach((destination, index) => {
        window.L.marker([destination.latitude, destination.longitude], {
            icon: stopIcon(index + 1, COLORS.muted),
        })
            .bindPopup(`<strong>${escapeHtml(destination.reference)}</strong><br>${escapeHtml(destination.address)}`)
            .addTo(layer);
        bounds.push([destination.latitude, destination.longitude]);
    });

    if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    attachPicker(map, config);

    document.querySelector('[data-distribute]')?.addEventListener('submit', (event) => {
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Repartiendo y optimizando…';
    });
}

/* ------------------------------------------------------------------ */
/* Admin: vehicle form (depot picker)                                   */
/* ------------------------------------------------------------------ */

function adminVehicleForm() {
    const config = readJson('map-config');
    const map = createMap(document.querySelector('[data-map]'), config.center);

    if (map) {
        attachPicker(map, config);
    }
}

/* ------------------------------------------------------------------ */
/* Public tracking page                                                 */
/* ------------------------------------------------------------------ */

function trackingScreen() {
    const config = readJson('state-config');
    const map = createMap(document.querySelector('[data-map]'), config.center);
    const field = (name) => document.querySelector(`[data-field="${name}"]`);
    const etaBlock = document.querySelector('[data-eta-block]');
    let layer = null;

    const tagClass = (status) => {
        if (status === 'completed') {
            return 'tag tag-done';
        }
        if (status === 'failed') {
            return 'tag bg-alert-50 border-alert text-alert';
        }
        return 'tag tag-accent';
    };

    const render = (state) => {
        field('reference').textContent = state.reference;
        field('address').textContent = state.address;

        const tag = field('status_label');
        tag.textContent = state.status_label;
        tag.className = tagClass(state.status);

        field('service_date').textContent = state.service_date ? `Entrega: ${state.service_date}` : '';
        field('message').textContent = state.completed_at ? `${state.message} (${state.completed_at} h)` : state.message;

        const showEta = state.status === 'pending' && state.eta_minutes !== null;
        etaBlock?.classList.toggle('hidden', !showEta);

        if (showEta) {
            field('queue_position').textContent = state.queue_position ?? '—';
            field('eta_minutes').textContent = `~${state.eta_minutes}`;
        }

        field('vehicle_line').textContent = state.vehicle ? `${state.vehicle.name} · ${state.vehicle.plate}` : '';

        if (map) {
            layer?.remove();
            layer = window.L.layerGroup().addTo(map);

            const bounds = [[state.destination.latitude, state.destination.longitude]];

            (state.legs ?? []).forEach((geometry) => {
                if (geometry?.length > 1) {
                    window.L.polyline(geometry, { color: COLORS.accent, weight: 4, opacity: 0.8 }).addTo(layer);
                    bounds.push(...geometry);
                }
            });

            window.L.marker([state.destination.latitude, state.destination.longitude], {
                icon: stopIcon('⌂', COLORS.accent, { size: 32, ring: true }),
                zIndexOffset: 1000,
            })
                .bindPopup(`<strong>${escapeHtml(state.reference)}</strong><br>${escapeHtml(state.address)}`)
                .addTo(layer);

            if (state.vehicle?.position) {
                window.L.marker([state.vehicle.position.latitude, state.vehicle.position.longitude], {
                    icon: vehicleIcon(),
                    zIndexOffset: 1200,
                })
                    .bindPopup('<strong>Tu repartidor</strong>')
                    .addTo(layer);
                bounds.push([state.vehicle.position.latitude, state.vehicle.position.longitude]);
            }

            if (bounds.length > 1) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
            }
        }
    };

    render(readJson('initial-state'));
    poll(config.url, render);
}

/* ------------------------------------------------------------------ */
/* Driver: proof of delivery + failure modals + GPS sharing             */
/* ------------------------------------------------------------------ */

const FAILURE_REASONS = {
    ausente: 'Cliente ausente',
    direccion_incorrecta: 'Dirección incorrecta',
    rechazado: 'Cliente rechazó la entrega',
    fuera_de_zona: 'Fuera de zona',
    otro: 'Otro motivo',
};

/**
 * Full-screen overlay asking for proof of delivery: recipient, photo,
 * signature pad and an optional note.
 */
function podOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[80] hidden flex-col bg-ruo-950/70 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="mx-auto mt-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto bg-white">
            <div class="bg-ruo-900 px-4 py-3 text-white">
                <h2 class="font-display text-lg font-bold uppercase">Prueba de entrega</h2>
                <p class="text-xs text-ruo-200">Opcional pero recomendado — queda guardada con la entrega.</p>
            </div>
            <div class="flex flex-col gap-4 px-4 py-4">
                <div>
                    <label class="label">Recibió (nombre)</label>
                    <input type="text" data-pod-recipient maxlength="120" class="input" placeholder="Ej: María Flores">
                </div>
                <div>
                    <label class="label">Foto de la entrega</label>
                    <input type="file" data-pod-photo accept="image/*" capture="environment" class="input p-2 text-sm">
                </div>
                <div>
                    <div class="mb-1.5 flex items-center justify-between">
                        <label class="label mb-0">Firma del cliente</label>
                        <button type="button" class="text-xs text-ruo-600 underline" data-pod-clear>Limpiar</button>
                    </div>
                    <canvas data-pod-canvas class="h-40 w-full touch-none border border-neutral-300 bg-white"></canvas>
                </div>
                <div>
                    <label class="label">Nota</label>
                    <input type="text" data-pod-note maxlength="500" class="input" placeholder="Ej: dejó con el portero">
                </div>
                <p class="hidden text-sm text-alert" data-pod-error></p>
                <div class="flex gap-3 pb-2">
                    <button type="button" class="btn btn-ghost flex-1" data-pod-cancel>Cancelar</button>
                    <button type="button" class="btn btn-success flex-[2] py-3 font-display font-bold uppercase" data-pod-submit>✓ Confirmar entrega</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('[data-pod-canvas]');
    const context = canvas.getContext('2d');
    let drawing = false;
    let signed = false;

    const resize = () => {
        const image = signed ? canvas.toDataURL() : null;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        context.lineWidth = 2.5;
        context.lineCap = 'round';
        context.strokeStyle = '#1e3a5f';
        if (image) {
            const img = new Image();
            img.onload = () => context.drawImage(img, 0, 0);
            img.src = image;
        }
    };

    const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    };

    canvas.addEventListener('pointerdown', (event) => {
        drawing = true;
        signed = true;
        canvas.setPointerCapture(event.pointerId);
        context.beginPath();
        context.moveTo(...point(event));
    });
    canvas.addEventListener('pointermove', (event) => {
        if (!drawing) {
            return;
        }
        context.lineTo(...point(event));
        context.stroke();
    });
    canvas.addEventListener('pointerup', () => (drawing = false));
    overlay.querySelector('[data-pod-clear]').addEventListener('click', () => {
        signed = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
    });

    let onSubmit = null;
    let onCancel = null;

    overlay.querySelector('[data-pod-submit]').addEventListener('click', () => onSubmit?.());
    overlay.querySelector('[data-pod-cancel]').addEventListener('click', () => {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        onCancel?.();
    });

    return {
        open({ submit, cancel }) {
            onSubmit = submit;
            onCancel = cancel;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            requestAnimationFrame(resize);
        },
        close() {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        },
        setError(message) {
            const error = overlay.querySelector('[data-pod-error]');
            error.textContent = message;
            error.classList.toggle('hidden', !message);
        },
        setBusy(busy) {
            const button = overlay.querySelector('[data-pod-submit]');
            button.disabled = busy;
            button.textContent = busy ? 'Guardando…' : '✓ Confirmar entrega';
        },
        formData(position) {
            const data = new FormData();
            const recipient = overlay.querySelector('[data-pod-recipient]').value.trim();
            const note = overlay.querySelector('[data-pod-note]').value.trim();
            const photo = overlay.querySelector('[data-pod-photo]').files[0];

            if (recipient) data.append('recipient_name', recipient);
            if (note) data.append('note', note);
            if (photo) data.append('photo', photo);
            if (signed) data.append('signature', canvas.toDataURL('image/png'));
            if (position) {
                data.append('latitude', position.latitude);
                data.append('longitude', position.longitude);
            }

            return data;
        },
    };
}

/**
 * Overlay to report a delivery as failed with a reason.
 */
function failOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[80] hidden flex-col bg-ruo-950/70 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="mx-auto mt-auto w-full max-w-xl bg-white">
            <div class="bg-alert px-4 py-3 text-white">
                <h2 class="font-display text-lg font-bold uppercase">No se pudo entregar</h2>
                <p class="text-xs text-white/80">El administrador podrá reagendar este destino.</p>
            </div>
            <div class="flex flex-col gap-2 px-4 py-4" data-fail-reasons>
                ${Object.entries(FAILURE_REASONS)
                    .map(
                        ([value, label], index) => `
                        <label class="flex cursor-pointer items-center gap-3 border border-neutral-200 px-3 py-2.5 text-sm has-checked:border-ruo-600 has-checked:bg-ruo-50">
                            <input type="radio" name="failure_reason" value="${value}" class="accent-ruo-600" ${index === 0 ? 'checked' : ''}>
                            ${label}
                        </label>`,
                    )
                    .join('')}
            </div>
            <p class="hidden px-4 text-sm text-alert" data-fail-error></p>
            <div class="flex gap-3 px-4 pb-4">
                <button type="button" class="btn btn-ghost flex-1" data-fail-cancel>Cancelar</button>
                <button type="button" class="btn btn-alert flex-[2] py-3 font-display font-bold uppercase" data-fail-submit>Marcar como fallido</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    let onSubmit = null;
    let onCancel = null;

    overlay.querySelector('[data-fail-submit]').addEventListener('click', () => {
        const reason = overlay.querySelector('input[name="failure_reason"]:checked')?.value;
        onSubmit?.(reason);
    });
    overlay.querySelector('[data-fail-cancel]').addEventListener('click', () => {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        onCancel?.();
    });

    return {
        open({ submit, cancel }) {
            onSubmit = submit;
            onCancel = cancel;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        },
        close() {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        },
        setError(message) {
            const error = overlay.querySelector('[data-fail-error]');
            error.textContent = message;
            error.classList.toggle('hidden', !message);
        },
        setBusy(busy) {
            const button = overlay.querySelector('[data-fail-submit]');
            button.disabled = busy;
            button.textContent = busy ? 'Guardando…' : 'Marcar como fallido';
        },
    };
}

/**
 * Share the driver's GPS position while the route is running.
 */
function startPositionSharing(config) {
    if (!navigator.geolocation) {
        return () => {};
    }

    let lastSent = 0;
    const watch = navigator.geolocation.watchPosition(
        async (position) => {
            const now = Date.now();

            if (now - lastSent < POSITION_MIN_INTERVAL_MS) {
                return;
            }

            lastSent = now;

            try {
                await fetch(config.positionUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    }),
                });
            } catch {
                /* silent — next tick retries */
            }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
}

/**
 * Best-effort snapshot of the driver's position for the delivery proof.
 */
function currentPosition() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            return resolve(null);
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 },
        );
    });
}

/* ------------------------------------------------------------------ */
/* Driver screens                                                       */
/* ------------------------------------------------------------------ */

function driverScreens(page) {
    const config = readJson('state-config');
    let state = readJson('initial-state');
    const root = document.querySelector('[data-route-root]');
    const empty = document.querySelector('[data-empty]');
    const map = createMap(document.querySelector('[data-map]'), config.center);
    const pod = podOverlay();
    const fail = failOverlay();
    let routeLayer = null;
    let completing = false;
    let stopSharing = null;

    const activeDestination = (route) => route.destinations.find((destination) => destination.id === route.active_id) ?? null;

    const renderEmpty = (current) => {
        const titles = {
            no_vehicle: ['No tienes un vehículo asignado', 'Pide al administrador que te asigne un vehículo.'],
            no_route: ['Tu ruta aún no está lista', 'Cuando el administrador genere la ruta de hoy, aparecerá aquí automáticamente.'],
        };
        const [title, text] = titles[current.status] ?? titles.no_route;

        root.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.classList.add('flex');
        empty.querySelector('[data-empty-title]').textContent = title;
        empty.querySelector('[data-empty-text]').textContent = text;
    };

    const activeBanner = (route, active, withDirectionsLink) => {
        const position = route.completed + route.failed + 1;
        const legInfo = active.leg_km > 0
            ? `<div><p class="text-[9px] tracking-[0.08em] text-ruo-300 uppercase">Distancia</p><p class="font-display text-2xl font-bold">${formatNumber(active.leg_km)} km</p></div>
               <div><p class="text-[9px] tracking-[0.08em] text-ruo-300 uppercase">Tiempo est.</p><p class="font-display text-2xl font-bold">~${active.leg_minutes} min</p></div>`
            : `<div><p class="text-[9px] tracking-[0.08em] text-ruo-300 uppercase">Inicio</p><p class="font-display text-2xl font-bold">1.ª parada</p></div>`;

        return `
            <section class="bg-ruo-900 px-4 pt-4 pb-5 text-neutral-100">
                <p class="mb-1 font-display text-[10px] tracking-[0.1em] text-ruo-300 uppercase">
                    Destino activo · ${position} de ${route.total}
                    ${active.is_unplanned ? '<span class="ml-1 bg-alert px-1.5 py-0.5 text-white">Imprevisto</span>' : ''}
                </p>
                <h1 class="font-display text-2xl leading-tight font-bold uppercase">${escapeHtml(active.reference)}</h1>
                <p class="mb-1 text-sm text-ruo-200">${escapeHtml(active.address)}</p>
                ${active.phone ? `<a href="tel:${escapeHtml(active.phone)}" class="mb-3 inline-block text-sm font-semibold text-ruo-200 underline underline-offset-4">📞 ${escapeHtml(active.phone)}</a>` : ''}
                <div class="mb-4 mt-3 flex gap-6">
                    ${legInfo}
                    <div><p class="text-[9px] tracking-[0.08em] text-ruo-300 uppercase">Restantes</p><p class="font-display text-2xl font-bold">${route.remaining}</p></div>
                </div>
                <button type="button" class="btn btn-success w-full py-4 font-display text-base font-bold tracking-[0.06em] uppercase" data-complete="${active.id}">
                    ✓ Marcar como completado
                </button>
                <button type="button" class="btn mt-2 w-full border-neutral-600 bg-transparent py-2.5 text-sm font-semibold text-ruo-200 hover:text-white" data-fail="${active.id}">
                    No se pudo entregar
                </button>
                ${withDirectionsLink ? `<a href="${config.activeUrl}" class="mt-3 block text-center text-sm text-ruo-200 underline underline-offset-4">Ver indicaciones para llegar →</a>` : ''}
                <p class="mt-2 hidden text-center text-sm text-alert" data-complete-error></p>
            </section>`;
    };

    const listItem = (destination, route) => {
        const isDone = destination.status === 'completed';
        const isFailed = destination.status === 'failed';
        const isActive = destination.id === route.active_id;

        const badge = isDone
            ? `<span class="flex size-7 shrink-0 items-center justify-center bg-done text-sm text-white">✓</span>`
            : isFailed
              ? `<span class="flex size-7 shrink-0 items-center justify-center bg-alert text-sm text-white">✕</span>`
              : `<span class="flex size-7 shrink-0 items-center justify-center font-display text-sm font-bold ${isActive ? (destination.is_unplanned ? 'bg-alert text-white' : 'bg-ruo-600 text-white') : destination.is_unplanned ? 'border border-alert text-alert' : 'border border-neutral-300 text-neutral-500'}">${destination.position}</span>`;

        const tag = isDone
            ? `<span class="text-xs text-done">${escapeHtml(destination.completed_at ?? '✓')}</span>`
            : isFailed
              ? `<span class="tag tag-alert" title="${escapeHtml(destination.failure_reason ?? '')}">Fallido</span>`
              : isActive
                ? `<span class="tag tag-accent">Activo</span>`
                : destination.is_unplanned
                  ? `<span class="tag tag-alert">Nuevo</span>`
                  : `<span class="tag tag-outline">${formatNumber(destination.leg_km)} km</span>`;

        return `
            <li class="flex min-h-[60px] items-center gap-3 border-b border-neutral-100 px-4 py-3 ${isDone ? 'bg-neutral-50' : ''} ${isFailed ? 'bg-alert-50/40' : ''} ${isActive ? 'border-l-4 border-l-ruo-600 bg-ruo-50' : ''}">
                ${badge}
                <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-semibold ${isDone ? 'text-neutral-400 line-through' : ''} ${isFailed ? 'text-alert' : ''}">${escapeHtml(destination.reference)}</p>
                    <p class="truncate text-sm ${isDone || isFailed ? 'text-neutral-400' : 'text-neutral-500'}">${escapeHtml(isFailed && destination.failure_reason ? destination.failure_reason : destination.address)}</p>
                </div>
                ${tag}
            </li>`;
    };

    const renderSteps = (active) => {
        const stepsEl = document.querySelector('[data-steps]');

        if (!stepsEl) {
            return;
        }

        if (!active.steps?.length) {
            stepsEl.innerHTML = `<li class="px-4 py-5 text-sm text-neutral-500">Esta es la primera parada de la ruta: dirígete a la dirección indicada.</li>`;

            return;
        }

        stepsEl.innerHTML = active.steps
            .map((step, index) => `
                <li class="flex items-start gap-3 px-4 py-3">
                    <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-ruo-300 font-display text-xs font-bold text-ruo-600">${index + 1}</span>
                    <p class="flex-1 text-[15px]">${escapeHtml(step.text)}</p>
                    ${step.distance > 0 ? `<span class="text-sm whitespace-nowrap text-neutral-500">${formatDistance(step.distance)}</span>` : ''}
                </li>`)
            .join('');
    };

    const render = (current) => {
        if (!current.route) {
            renderEmpty(current);

            return;
        }

        if (current.status === 'completed') {
            window.location.href = config.summaryUrl;

            return;
        }

        empty.classList.add('hidden');
        empty.classList.remove('flex');
        root.classList.remove('hidden');

        const route = current.route;
        const active = activeDestination(route);

        root.querySelector('[data-active]').innerHTML = active ? activeBanner(route, active, page === 'driver-route') : '';

        const list = root.querySelector('[data-list]');

        if (list) {
            list.innerHTML = route.destinations.map((destination) => listItem(destination, route)).join('');
            root.querySelector('[data-progress]').textContent = `${route.completed} de ${route.total} completados${route.failed ? ` · ${route.failed} fallidos` : ''} · ${formatNumber(route.route_km)} km`;
        }

        if (active) {
            renderSteps(active);
        }

        if (map) {
            routeLayer?.remove();
            routeLayer = drawRoute(map, route, { focusActive: page === 'driver-active' });
            setTimeout(() => map.invalidateSize(), 50);
        }
    };

    const applyState = (next, { fromServerPush = true } = {}) => {
        const previous = state;
        state = next;

        if (previous.signature === next.signature) {
            return;
        }

        const previousTotal = previous.route?.total ?? 0;
        const nextTotal = next.route?.total ?? 0;

        if (fromServerPush && previous.route && next.route && nextTotal > previousTotal) {
            showToast('Nuevo destino agregado · ruta recalculada');
            root.classList.remove('flash-updated');
            void root.offsetWidth;
            root.classList.add('flash-updated');
        } else if (fromServerPush && !previous.route && next.route) {
            showToast('Tu ruta del día está lista');
        }

        render(next);
    };

    const syncPositionSharing = (current) => {
        if (current.route && current.status !== 'completed' && !stopSharing) {
            stopSharing = startPositionSharing(config);
        } else if ((!current.route || current.status === 'completed') && stopSharing) {
            stopSharing();
            stopSharing = null;
        }
    };

    const completeDestination = async (destinationId) => {
        pod.setBusy(true);
        pod.setError('');

        const position = await currentPosition();

        try {
            const result = await postForm(config.completeUrl.replace('__ID__', destinationId), pod.formData(position));

            if (result.finished) {
                window.location.href = result.redirect;

                return;
            }

            pod.close();
            applyState(await fetchJson(config.url), { fromServerPush: false });

            if (page === 'driver-active') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            pod.setError(error.message);
            applyState(await fetchJson(config.url).catch(() => state));
        } finally {
            pod.setBusy(false);
        }
    };

    const failDestination = async (destinationId, reason) => {
        fail.setBusy(true);
        fail.setError('');

        try {
            const result = await fetchJson(config.failUrl.replace('__ID__', destinationId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken() },
                body: JSON.stringify({ reason }),
            });

            if (result.finished) {
                window.location.href = result.redirect;

                return;
            }

            fail.close();
            applyState(await fetchJson(config.url), { fromServerPush: false });
        } catch (error) {
            fail.setError(error.message);
            applyState(await fetchJson(config.url).catch(() => state));
        } finally {
            fail.setBusy(false);
        }
    };

    root.addEventListener('click', (event) => {
        const completeButton = event.target.closest('[data-complete]');
        const failButton = event.target.closest('[data-fail]');

        if (completeButton) {
            completing = false;
            pod.setError('');
            pod.setBusy(false);
            pod.open({
                submit: () => {
                    if (completing) {
                        return;
                    }
                    completing = true;
                    completeDestination(completeButton.dataset.complete).finally(() => (completing = false));
                },
            });
        }

        if (failButton) {
            completing = false;
            fail.setError('');
            fail.setBusy(false);
            fail.open({
                submit: (reason) => {
                    if (completing) {
                        return;
                    }
                    completing = true;
                    failDestination(failButton.dataset.fail, reason).finally(() => (completing = false));
                },
            });
        }
    });

    render(state);
    syncPositionSharing(state);

    poll(config.url, (next) => {
        applyState(next);
        syncPositionSharing(next);
    });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */

const page = document.body.dataset.page;

if (page === 'admin-dashboard') {
    adminDashboard();
} else if (page === 'admin-destinations' || page === 'admin-unplanned') {
    adminDestinationMap();
} else if (page === 'admin-pool') {
    adminPool();
} else if (page === 'admin-vehicle-form') {
    adminVehicleForm();
} else if (page === 'tracking') {
    trackingScreen();
} else if (page === 'driver-route' || page === 'driver-active') {
    driverScreens(page);
}
