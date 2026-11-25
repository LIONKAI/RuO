-- RuO · esquema Postgres para Supabase (multi-empresa)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- Para bases ya existentes NO uses este archivo: usa migration-multitenant.sql

-- Empresas clientes del SaaS. La api_key identifica a la empresa en la API
-- de integraciones (bot de WhatsApp / n8n).
create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    active boolean not null default true,
    api_key text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Perfiles ligados a auth.users.
-- role: 'superadmin' (dueño de la plataforma, company_id null)
--       'admin'      (dueño/despachador de una empresa)
--       'driver'     (chofer de una empresa)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    company_id uuid references public.companies (id) on delete cascade,
    name text not null,
    role text not null default 'driver' check (role in ('superadmin', 'admin', 'driver')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
    id bigint generated always as identity primary key,
    company_id uuid not null references public.companies (id) on delete cascade,
    driver_id uuid unique references public.profiles (id) on delete set null,
    name text not null,
    plate text not null unique,
    fuel_liters_per_km numeric(6, 3) not null default 0.10,
    depot_address text,
    depot_latitude double precision,
    depot_longitude double precision,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists vehicles_company_idx on public.vehicles (company_id);

create table if not exists public.workdays (
    id bigint generated always as identity primary key,
    company_id uuid not null references public.companies (id) on delete cascade,
    vehicle_id bigint not null references public.vehicles (id) on delete cascade,
    date date not null,
    status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
    route_version integer not null default 0,
    route_updated_at timestamptz,
    total_km numeric(8, 2),
    estimated_fuel_liters numeric(8, 2),
    last_latitude double precision,
    last_longitude double precision,
    last_position_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (vehicle_id, date)
);

create index if not exists workdays_company_date_idx on public.workdays (company_id, date);

create table if not exists public.destinations (
    id bigint generated always as identity primary key,
    company_id uuid not null references public.companies (id) on delete cascade,
    workday_id bigint references public.workdays (id) on delete cascade, -- null = pool de pedidos
    address text not null,
    reference text not null,
    phone text,
    latitude double precision not null,
    longitude double precision not null,
    status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
    is_unplanned boolean not null default false,
    position integer,
    leg_distance_meters integer,
    leg_duration_seconds integer,
    leg_geometry jsonb,
    leg_steps jsonb,
    completed_at timestamptz,
    failure_reason text,
    failed_at timestamptz,
    service_date date not null default current_date,
    public_token uuid not null default gen_random_uuid() unique,
    recipient_name text,
    pod_note text,
    pod_photo_path text,
    pod_signature_path text,
    delivered_latitude double precision,
    delivered_longitude double precision,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists destinations_workday_position_idx on public.destinations (workday_id, position);
create index if not exists destinations_service_date_idx on public.destinations (service_date, workday_id);
create index if not exists destinations_company_idx on public.destinations (company_id, service_date);

-- Los perfiles los crea la aplicación (server actions con service role):
-- el registro de empresa y el alta de choferes pasan por /registro y
-- /admin/choferes, que controlan rol y empresa. No hay trigger automático
-- porque el rol y la empresa NUNCA deben venir de metadata del cliente.

-- Bucket para prueba de entrega (fotos y firmas; privado, se sirven con signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pod', 'pod', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seguridad: Row Level Security
--
-- La anon key viaja al navegador, así que sin RLS cualquiera podría leer o
-- modificar estas tablas por la API REST de Supabase. El servidor de Next
-- accede con Drizzle usando el rol "postgres" (DATABASE_URL), que no está
-- sujeto a RLS, así que la app sigue funcionando igual. Por la API pública
-- solo queda permitido que cada usuario lea su propio perfil (lo usan el
-- login y el proxy para conocer el rol).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.workdays enable row level security;
alter table public.destinations enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own" on public.companies
    for select to authenticated
    using (id = (select company_id from public.profiles where id = (select auth.uid())));


-- Sin políticas de escritura ni de lectura cruzada: todo lo demás pasa por el servidor.

-- ─────────────────────────────────────────────────────────────────────────────
-- Superadministrador de la plataforma: crea el usuario en
-- Authentication → Users → Add user y luego (cambia el correo):
--
--   insert into public.profiles (id, name, role, company_id)
--   values ((select id from auth.users where email = 'tu-correo@ruo.com'), 'Tu Nombre', 'superadmin', null)
--   on conflict (id) do update set role = 'superadmin', company_id = null;
--
-- Las empresas clientes NO se crean a mano: se registran solas en /registro.
-- ─────────────────────────────────────────────────────────────────────────────
