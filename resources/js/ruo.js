/**
 * RuO front-end: live screens for the admin and the driver.
 * Leaflet is loaded from a CDN only on pages that show a map (window.L).
 */

const POLL_INTERVAL_MS = 3000;

const COLORS = {
    accent: '#2f6496',
    navy: '#1e3a5f',
    done: '#27ae60',
    alert: '#e67e22',
    muted: '#a3a3a3',
};

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

/**
 * Draws the destinations and route legs of a workday. Returns a layer group.
 */
function drawRoute(map, route, { focusActive = false } = {}) {
    const layer = window.L.layerGroup().addTo(map);

    if (!route || !route.destinations?.length) {
        return layer;
    }

    const bounds = [];
    const ordered = route.destinations.some((destination) => destination.position);

    route.destinations.forEach((destination, index) => {
        const isDone = destination.status === 'completed';
        const isActive = destination.id === route.active_id;

        if (destination.geometry?.length > 1) {
            window.L.polyline(destination.geometry, {
                color: isDone ? COLORS.done : isActive ? COLORS.accent : COLORS.navy,
                weight: isActive ? 6 : 4,
                opacity: isDone ? 0.55 : 0.85,
                dashArray: isDone ? '6 8' : null,
            }).addTo(layer);

            if (!focusActive || isActive) {
                bounds.push(...destination.geometry);
            }
        }

        let color = ordered ? COLORS.navy : COLORS.muted;

        if (isDone) {
            color = COLORS.done;
        } else if (destination.is_unplanned) {
            color = COLORS.alert;
        } else if (isActive) {
            color = COLORS.accent;
        }

        const label = isDone ? '✓' : destination.position ?? index + 1;

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

    if (bounds.length === 1) {
        map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    }

    return layer;
}

/* ------------------------------------------------------------------ */
/* Admin: live dashboard                                                */
/* ------------------------------------------------------------------ */

function adminDashboard() {
    const config = readJson('state-config');
    const statsEl = document.querySelector('[data-stats]');
    const vehiclesEl = document.querySelector('[data-vehicles]');
    const updatedEl = document.querySelector('[data-updated-at]');
    const errorEl = document.querySelector('[data-connection-error]');

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
                        <span class="font-semibold text-ruo-700" data-progress-label>${vehicle.completed} de ${vehicle.total} completados</span>
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

    document.querySelector('[data-generate-route]')?.addEventListener('submit', (event) => {
        const button = event.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Calculando ruta óptima…';
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
    let routeLayer = null;
    let completing = false;

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
        const position = route.completed + 1;
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
                <p class="mb-4 text-sm text-ruo-200">${escapeHtml(active.address)}</p>
                <div class="mb-4 flex gap-6">
                    ${legInfo}
                    <div><p class="text-[9px] tracking-[0.08em] text-ruo-300 uppercase">Restantes</p><p class="font-display text-2xl font-bold">${route.remaining}</p></div>
                </div>
                <button type="button" class="btn btn-success w-full py-4 font-display text-base font-bold tracking-[0.06em] uppercase" data-complete="${active.id}">
                    ✓ Marcar como completado
                </button>
                ${withDirectionsLink ? `<a href="${config.activeUrl}" class="mt-3 block text-center text-sm text-ruo-200 underline underline-offset-4">Ver indicaciones para llegar →</a>` : ''}
                <p class="mt-2 hidden text-center text-sm text-alert" data-complete-error></p>
            </section>`;
    };

    const listItem = (destination, route) => {
        const isDone = destination.status === 'completed';
        const isActive = destination.id === route.active_id;

        const badge = isDone
            ? `<span class="flex size-7 shrink-0 items-center justify-center bg-done text-sm text-white">✓</span>`
            : `<span class="flex size-7 shrink-0 items-center justify-center font-display text-sm font-bold ${isActive ? (destination.is_unplanned ? 'bg-alert text-white' : 'bg-ruo-600 text-white') : destination.is_unplanned ? 'border border-alert text-alert' : 'border border-neutral-300 text-neutral-500'}">${destination.position}</span>`;

        const tag = isDone
            ? `<span class="text-xs text-done">${escapeHtml(destination.completed_at ?? '✓')}</span>`
            : isActive
              ? `<span class="tag tag-accent">Activo</span>`
              : destination.is_unplanned
                ? `<span class="tag tag-alert">Nuevo</span>`
                : `<span class="tag tag-outline">${formatNumber(destination.leg_km)} km</span>`;

        return `
            <li class="flex min-h-[60px] items-center gap-3 border-b border-neutral-100 px-4 py-3 ${isDone ? 'bg-neutral-50' : ''} ${isActive ? 'border-l-4 border-l-ruo-600 bg-ruo-50' : ''}">
                ${badge}
                <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-semibold ${isDone ? 'text-neutral-400 line-through' : ''}">${escapeHtml(destination.reference)}</p>
                    <p class="truncate text-sm ${isDone ? 'text-neutral-400' : 'text-neutral-500'}">${escapeHtml(destination.address)}</p>
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
            root.querySelector('[data-progress]').textContent = `${route.completed} de ${route.total} completados · ${formatNumber(route.route_km)} km`;
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

    root.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-complete]');

        if (!button || completing) {
            return;
        }

        completing = true;
        button.disabled = true;
        button.textContent = 'Guardando…';

        try {
            const result = await fetchJson(config.completeUrl.replace('__ID__', button.dataset.complete), {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken() },
            });

            if (result.finished) {
                window.location.href = result.redirect;

                return;
            }

            applyState(await fetchJson(config.url), { fromServerPush: false });

            if (page === 'driver-active') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            const message = root.querySelector('[data-complete-error]');
            button.disabled = false;
            button.textContent = '✓ Marcar como completado';

            if (message) {
                message.textContent = error.message;
                message.classList.remove('hidden');
            }

            applyState(await fetchJson(config.url).catch(() => state));
        } finally {
            completing = false;
        }
    });

    render(state);
    poll(config.url, (next) => {
        if (!completing) {
            applyState(next);
        }
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
} else if (page === 'driver-route' || page === 'driver-active') {
    driverScreens(page);
}
