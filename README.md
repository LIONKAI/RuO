# RuO · Ruta Óptima

[![tests](https://github.com/LIONKAI/RuO/actions/workflows/tests.yml/badge.svg)](https://github.com/LIONKAI/RuO/actions/workflows/tests.yml)
![PHP](https://img.shields.io/badge/PHP-8.3-777BB4?logo=php&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-13-FF2D20?logo=laravel&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-mapas-199900?logo=leaflet&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)

Sistema web para **planificar y seguir rutas de reparto**. El administrador carga los destinos del día por vehículo, RuO calcula el orden óptimo de visita y el chofer sigue la ruta paso a paso desde el celular.

**[Demo en vivo](https://TU-DOMINIO.up.railway.app)** · Hecho en Santa Cruz de la Sierra, Bolivia

![RuO en acción](docs/demo.gif)

## Qué hace

**Administrador**
- Carga destinos escribiendo la dirección (geocodificación automática) o marcándolos en el mapa.
- Genera la ruta óptima de cada vehículo con un clic.
- Agrega destinos imprevistos en plena jornada: la ruta se recalcula al instante desde la última entrega.
- Ve el avance de la flota y un resumen con kilómetros recorridos y combustible estimado.

**Chofer**
- Ve su ruta del día en el mapa y el destino activo.
- Recibe indicaciones giro a giro en español.
- Marca cada entrega como completada; la jornada se cierra sola al terminar.

## Cómo funciona la optimización

El orden de visita es un **problema del viajante (TSP)**. RuO lo resuelve con el servicio `trip` de [OSRM](https://project-osrm.org/) sobre la red vial real de OpenStreetMap:

1. Si la jornada ya empezó, la ruta se ancla en el último destino completado y solo se reordenan los pendientes.
2. Si no, se pide un circuito cerrado y se abre quitando su tramo más largo, para obtener el recorrido abierto más corto.
3. Se guarda la geometría, distancia, duración e instrucciones de cada tramo; el panel del chofer se actualiza por versión de ruta.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | PHP 8.3, Laravel 13 |
| Frontend | Blade, Tailwind CSS 4, Bootstrap 5, Vite |
| Mapas | Leaflet, OSRM (rutas), Nominatim (geocodificación) |
| Base de datos | MySQL 8 |
| Tests | Pest 4 (31 tests) |
| Despliegue | Railway + GitHub Actions |

```
app/
├── Services/
│   ├── RouteOptimizer.php       # TSP con OSRM y armado de tramos
│   ├── WorkdayManager.php       # destinos, imprevistos y cierre de jornada
│   ├── Geocoder.php             # direcciones → coordenadas (Nominatim)
│   └── DirectionsTranslator.php # maniobras de OSRM → español
├── Models/                      # Vehicle → Workday → Destination
└── Http/Controllers/{Admin,Driver}
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

## Despliegue en Railway

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

## Limitaciones conocidas y próximos pasos

- Usa los servidores públicos de OSRM y Nominatim, pensados para demos (con límite de uso).
- La ruta todavía no parte de una base o almacén del vehículo.
- Optimiza cada vehículo por separado; repartir destinos entre la flota (VRP) es el siguiente paso.

## Autor

**Rolando Raúl Gutiérrez** · Estudiante de Ingeniería de Sistemas, Unifranz
