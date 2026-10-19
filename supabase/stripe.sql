-- Run this once in the Supabase SQL editor.
-- Customers can no longer put an order straight into the queue.
-- Only a paid Stripe payment moves it to "new".

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (user_id = auth.uid() and status = 'unpaid');

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
    and orders.status <> 'cancelled'
    and not (orders.status = 'unpaid' and orders.created_at < now() - interval '20 minutes');
$$;
