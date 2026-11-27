-- Planes y límites por empresa (panel de plataforma).
alter table companies add column if not exists plan text not null default 'piloto';
alter table companies add column if not exists max_vehicles integer not null default 5;
alter table companies add column if not exists monthly_price numeric(8,2) not null default 300;
alter table companies add column if not exists notes text;
