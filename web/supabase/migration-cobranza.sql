-- Cobranza contraentrega: monto a cobrar, resultado y método de pago.
alter table destinations add column if not exists amount_to_collect numeric(10,2);
alter table destinations add column if not exists collection_status text;
alter table destinations add column if not exists payment_method text;
