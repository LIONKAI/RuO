# RuO · Ruta Óptima — versión web (Next.js + Supabase)

Port de la app Laravel a **Next.js 16 + Supabase (Postgres, Auth y Storage)**, pensado para desplegarse en **Vercel**.

| Capa | Tecnología |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, Tailwind 4 |
| Datos | Supabase Postgres vía Drizzle ORM |
| Auth | Supabase Auth (correo + contraseña), roles `admin` / `driver` en `profiles` |
| Archivos | Supabase Storage (bucket privado `pod` para foto y firma) |
| Mapas | Leaflet, OSRM (rutas), Nominatim (geocodificación) |

## 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: pega `supabase/schema.sql` y ejecútalo. Crea las tablas, el bucket `pod` y activa **Row Level Security**.
3. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up*. Las cuentas las crea el administrador.
4. **Authentication → Users → Add user**: crea el administrador y los choferes (marca *Auto Confirm User*). Todos nacen con rol `driver`.
5. Promueve al administrador en el SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'admin@ruo.com');
   ```
6. Copia las claves de **Project Settings → API** y la cadena de conexión de **Connect → Transaction pooler** (puerto `6543`).

## 2. Vercel

1. **Add New → Project** e importa el repositorio `LIONKAI/RuO`.
2. **Root Directory: `web`**. La raíz del repo es la app Laravel; si no cambias esto Vercel intentará construir PHP.
3. Framework: Next.js (se detecta solo). Build y output por defecto.
4. **Environment Variables**: todas las de `.env.local.example`, con tus valores:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` → el **Transaction pooler** (`...pooler.supabase.com:6543/postgres`)
   - `NOMINATIM_USER_AGENT` con un correo real (lo exige la política de uso de Nominatim)
   - El resto puede quedar con los valores del ejemplo.
5. **Deploy**. Luego, en el panel: **Vehículos** → crea cada vehículo con el correo de su chofer y la dirección del depósito.

## Desarrollo local

```bash
cd web
npm install
cp .env.local.example .env.local   # completa los valores
npm run dev                         # http://localhost:3000
```

```bash
npm test          # vitest (servicios y reglas de autorización)
npm run lint
npm run build
```

## Notas de seguridad

- La anon key es pública (va en el navegador). Por eso todas las tablas tienen RLS y la API pública solo permite que cada usuario lea su propio perfil.
- El servidor accede a los datos con Drizzle (`DATABASE_URL`), que no está sujeto a RLS. Toda la autorización vive en `src/lib/auth.ts` y `src/lib/guards.ts`, y se revalida dentro de cada server action.
- `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` nunca deben llevar el prefijo `NEXT_PUBLIC_`.

## Límites conocidos

- OSRM y Nominatim usan los servidores públicos de demostración: sirven para la presentación, no para producción (límites de uso y sin garantía).
- El reparto entre la flota agrupa por zona (k-means), pero no equilibra la cantidad de paradas ni considera capacidad.
