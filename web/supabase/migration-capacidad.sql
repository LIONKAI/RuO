-- Capacidad de vehículos + demanda y ventanas horarias de pedidos.
alter table vehicles add column if not exists capacity_units integer;
alter table destinations add column if not exists demand_units integer not null default 1;
alter table destinations add column if not exists window_start text;
alter table destinations add column if not exists window_end text;
