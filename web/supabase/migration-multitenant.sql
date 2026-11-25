-- RuO · migración a multi-empresa para la base de producción EXISTENTE
-- Ejecutar UNA SOLA VEZ en: Supabase → SQL Editor → New query → pegar → Run
-- Es seguro re-ejecutarlo (idempotente). Tus datos actuales quedan dentro de
-- una empresa inicial llamada "Mi Empresa" — luego puedes renombrarla.

begin;

-- 1) Tabla de empresas
create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    active boolean not null default true,
    api_key text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2) Empresa inicial para todos los datos existentes (id fijo y predecible)
insert into public.companies (id, name, slug)
values ('a0000000-0000-0000-0000-000000000001', 'Mi Empresa', 'mi-empresa')
on conflict (id) do nothing;

-- 3) Columnas company_id (nullable primero, se rellenan y luego se exigen)
alter table public.vehicles add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.workdays add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.destinations add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.profiles add column if not exists company_id uuid references public.companies (id) on delete cascade;

update public.vehicles set company_id = 'a0000000-0000-0000-0000-000000000001' where company_id is null;
update public.workdays set company_id = 'a0000000-0000-0000-0000-000000000001' where company_id is null;
update public.destinations set company_id = 'a0000000-0000-0000-0000-000000000001' where company_id is null;
-- Perfiles: solo los admin/driver pasan a la empresa; superadmin queda con null.
update public.profiles set company_id = 'a0000000-0000-0000-0000-000000000001' where company_id is null and role in ('admin', 'driver');

alter table public.vehicles alter column company_id set not null;
alter table public.workdays alter column company_id set not null;
alter table public.destinations alter column company_id set not null;

-- 4) Rol superadmin en el check de profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
    check (role in ('superadmin', 'admin', 'driver'));

-- 5) El trigger de auto-perfil se elimina: la app crea los perfiles con
--    rol y empresa controlados desde el servidor (/registro, /admin/choferes).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 6) Índices por empresa
create index if not exists vehicles_company_idx on public.vehicles (company_id);
create index if not exists workdays_company_date_idx on public.workdays (company_id, date);
create index if not exists destinations_company_idx on public.destinations (company_id, service_date);

-- 7) RLS también en companies
alter table public.companies enable row level security;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- DESPUÉS de esta migración:
--
-- a) Tu usuario admin actual sigue siendo admin de "Mi Empresa" — la demo
--    no se interrumpe.
--
-- b) Crea tu cuenta de superadmin (dueño de la plataforma): primero en
--    Authentication → Users → Add user (auto-confirm), luego aquí:
--
--   insert into public.profiles (id, name, role, company_id)
--   values ((select id from auth.users where email = 'tu-correo@ruo.com'), 'Tu Nombre', 'superadmin', null)
--   on conflict (id) do update set role = 'superadmin', company_id = null;
--
-- c) La api_key de "Mi Empresa" para el bot de WhatsApp la verás en
--    /admin/config dentro de la app.
-- ─────────────────────────────────────────────────────────────────────────────
