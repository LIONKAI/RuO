# RuO · Ruta Óptima

[![tests](https://github.com/LIONKAI/RuO/actions/workflows/tests.yml/badge.svg)](https://github.com/LIONKAI/RuO/actions/workflows/tests.yml)
![PHP](https://img.shields.io/badge/PHP-8.3-777BB4?logo=php&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-13-FF2D20?logo=laravel&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-mapas-199900?logo=leaflet&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)

Plataforma de **logística de última milla**: el administrador carga los pedidos del día, RuO los reparte entre la flota y calcula el orden óptimo de visita, el chofer sigue la ruta desde el celular y el cliente sigue su entrega en vivo con un link público.

Hecho en Santa Cruz de la Sierra, Bolivia

## Qué hace

**Administrador**
- Gestiona vehículos (con base/depósito) y choferes desde el panel.
- Pool de pedidos del día: carga uno a uno, por geocodificación o **importación masiva** (una línea por pedido).
- **Reparte el pool entre toda la flota con un clic** y optimiza la ruta de cada vehículo.
- Planifica cualquier fecha, no solo hoy.
- Mapa de flota en vivo con la posición GPS de cada chofer.
- Agrega destinos imprevistos en plena jornada: la ruta se recalcula desde la última entrega.
- Reagenda entregas fallidas; comparte links de tracking por **WhatsApp** (`wa.me`).
- Resumen del día: kilómetros, combustible estimado y % de cumplimiento.

**Chofer**
- Ve su ruta del día en el mapa con indicaciones giro a giro en español.
- **Comparte su posición GPS** mientras la ruta está activa.
- Registra **prueba de entrega**: foto, firma y notas.
- Marca entregas **fallidas con motivo** (cliente ausente, dirección incorrecta, rechazado).
- La jornada se cierra sola al terminar.

**Cliente final (sin registro)**
- Recibe un **link público de tracking**: ve en el mapa dónde va su pedido, cuántas paradas faltan y la hora estimada de llegada.

## Cómo funciona la optimización

Hay dos niveles:

**Reparto de flota (VRP)** — `FleetOptimizer`: agrupa geográficamente los pedidos del pool (k-means sobre coordenadas) y asigna cada grupo al vehículo cuyo depósito está más cerca del centroide del grupo.

**Orden de visita (TSP)** — `RouteOptimizer` con el servicio `trip` de [OSRM](https://project-osrm.org/) sobre la red vial real de OpenStreetMap:

1. La ruta parte del **depósito del vehículo** (o del último destino completado si la jornada ya empezó).
2. Se guarda la geometría, distancia, duración e instrucciones de cada tramo; el panel del chofer se actualiza por versión de ruta.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | PHP 8.3, Laravel 13 |
| Frontend | Blade, Tailwind CSS 4, Bootstrap 5, Vite |
| Mapas | Leaflet, OSRM (rutas), Nominatim (geocodificación) |
| Base de datos | MySQL 8 |
| Tests | Pest 4 (61 tests) |
| Despliegue | Docker (Render, Railway) + GitHub Actions |

```
app/
├── Services/
│   ├── RouteOptimizer.php       # TSP con OSRM, anclado al depósito
│   ├── FleetOptimizer.php       # reparto del pool entre la flota
│   ├── WorkdayManager.php       # destinos, PoD, fallidos y cierre
│   ├── Geocoder.php             # direcciones → coordenadas (Nominatim)
│   ├── DirectionsTranslator.php # maniobras de OSRM → español
│   └── WhatsApp.php             # mensajes y links wa.me
├── Models/                      # Vehicle → Workday → Destination
└── Http/Controllers/{Admin,Driver} + TrackingController (público)
```

## Instalación local

Requisitos: PHP 8.3+, Composer, Node 20+, MySQL (por ejemplo con Laragon).

```bash
git clone https://github.com/LIONKAI/RuO.git
cd ruo
composer install
npm install
cp .env.example .env
php artisan key:generate
# crea la base de datos "ruo" y ajusta DB_* en .env
php artisan migrate --seed
composer run dev
```

### Usuarios de demo

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | admin@ruo.com | admin123 |
| Chofer (Vehículo 1) | chofer1@ruo.com | chofer123 |
| Chofer (Vehículo 2) | chofer2@ruo.com | chofer123 |

## Despliegue

### Opción A — Render + Aiven (gratis)

App en Render (web service Docker, plan free) + MySQL en Aiven (plan free, 5 GB).

1. **Base de datos (Aiven)**: en [aiven.io](https://aiven.io) → *New service → MySQL → Free plan*. Copia host, puerto, usuario (`avnadmin`), contraseña y base (`defaultdb`).
2. **App (Render)**: en [render.com](https://render.com) → *New → Blueprint* → elegir este repo. `render.yaml` ya trae toda la config; Render pide solo los secretos (`APP_KEY`, `APP_URL`, `DB_*`, `NOMINATIM_USER_AGENT`).
   - `APP_KEY`: `php artisan key:generate --show`
   - `APP_URL`: el dominio `https://ruo-xxxx.onrender.com` que Render asigne
3. El Dockerfile hace todo: compila assets, instala dependencias, migra, `storage:link` y siembra demo si `RUO_SEED_DEMO=true`.
4. Ojo: el plan free de Render **duerme tras 15 min sin tráfico** (el primer request tarda ~1 min en despertar).

> Las fotos de prueba de entrega usan el disco `public` (efímero en Render). Para persistirlas: disco persistente de Render montado en `storage/app/public` o `FILESYSTEM_DISK=s3`.

### Opción B — Railway

1. **New Project → Deploy from GitHub repo** y elegir este repositorio.
2. Agregar un servicio **MySQL** al proyecto.
3. En el servicio de la app, variables:
   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=base64:...        # php artisan key:generate --show
   APP_URL=https://TU-DOMINIO.up.railway.app
   DB_CONNECTION=mysql
   DB_URL=${{MySQL.MYSQL_URL}}
   LOG_CHANNEL=stderr
   NOMINATIM_USER_AGENT="RuO/1.0 (tu-email@ejemplo.com)"
   RUO_SEED_DEMO=true
   ```
4. **Settings → Build command:** `npm run build`
5. **Settings → Pre-deploy command:** `sh ./railway/init-app.sh`
6. **Settings → Networking → Generate Domain.**

## Tests

```bash
php artisan test
```

## Roadmap

**Hecho**
- Depósito/base por vehículo como ancla de ruta
- Pool de pedidos + reparto entre la flota (VRP)
- Prueba de entrega (foto, firma, notas)
- Entregas fallidas con motivo y reagendado
- GPS del chofer y mapa de flota en vivo
- Tracking público por link para el cliente final
- Gestión de vehículos y choferes desde el panel
- Compartir tracking por WhatsApp (`wa.me`)

**Próximos pasos**
- Notificaciones automáticas por WhatsApp (Meta Cloud API): "tu pedido va en camino", "eres la parada 3"
- Bot de WhatsApp entrante: pedidos que llegan por chat y entran al pool
- Laravel Reverb (WebSockets) en lugar de polling para los mapas en vivo
- PWA para el chofer (GPS en background, modo offline)
- OSRM y Nominatim self-hosted para eliminar límites de los servidores públicos
- Multi-empresa (multi-tenancy) y API pública con webhooks

## Autor

**Rolando Raúl Gutiérrez** · Estudiante de Ingeniería de Sistemas, Unifranz
