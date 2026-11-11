-- RuO · esquema Postgres para Supabase
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run

-- Perfiles ligados a auth.users (rol admin | driver)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    name text not null,
    role text not null default 'driver' check (role in ('admin', 'driver')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
    id bigint generated always as identity primary key,
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

create table if not exists public.workdays (
    id bigint generated always as identity primary key,
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

create table if not exists public.destinations (
    id bigint generated always as identity primary key,
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

-- Perfil automático al registrarse (rol driver por defecto; el admin se promueve a mano)
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, name, role)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), 'driver')
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user ();

-- Bucket para prueba de entrega (fotos y firmas; privado, se sirven con signed URLs)
insert into storage.buckets (id, name, public)
values ('pod', 'pod', false)
on conflict (id) do nothing;
