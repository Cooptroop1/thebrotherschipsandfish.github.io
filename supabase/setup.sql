-- Run this once in the Supabase SQL editor after the project is created.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  address text not null default '',
  is_admin boolean not null default false
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text not null,
  slot text not null,
  day date not null,
  items jsonb not null,
  total_pence integer not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create unique index if not exists orders_one_slot
  on public.orders (day, slot)
  where status <> 'cancelled';

alter table public.profiles enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  );
$$;

create or replace function public.booked_slots(for_day date)
returns table (slot text)
language sql
stable
security definer
set search_path = public
as $$
  select orders.slot
  from public.orders
  where orders.day = for_day
    and orders.status <> 'cancelled';
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'address', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists orders_insert on public.orders;
drop policy if exists orders_select on public.orders;
drop policy if exists orders_update on public.orders;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy orders_insert on public.orders
  for insert with check (user_id = auth.uid());

create policy orders_select on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

create policy orders_update on public.orders
  for update using (public.is_admin())
  with check (public.is_admin());

revoke update on public.profiles from authenticated;
grant update (name, address) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant execute on function public.booked_slots(date) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
