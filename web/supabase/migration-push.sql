
-- Push subscriptions (PWA): endpoints de notificaciones push por perfil.
create table if not exists push_subscriptions (
    id integer generated always as identity primary key,
    profile_id uuid not null references profiles(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on push_subscriptions;
create policy push_subscriptions_select_own on push_subscriptions
    for select using (auth.uid() = profile_id);

drop policy if exists push_subscriptions_insert_own on push_subscriptions;
create policy push_subscriptions_insert_own on push_subscriptions
    for insert with check (auth.uid() = profile_id);

drop policy if exists push_subscriptions_delete_own on push_subscriptions;
create policy push_subscriptions_delete_own on push_subscriptions
    for delete using (auth.uid() = profile_id);
