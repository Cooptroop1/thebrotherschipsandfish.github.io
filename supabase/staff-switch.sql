-- Run once in the Supabase SQL editor.
-- Confirms the staff email, marks that account as staff, and lets the on/off switch save.

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'jcooper4888@aol.co.uk';

insert into public.profiles (id, name, address, is_admin)
select id, 'James', '', true
from auth.users
where email = 'jcooper4888@aol.co.uk'
on conflict (id) do update set is_admin = true;

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (
    user_id = auth.uid()
    and (
      status = 'unpaid'
      or (slot = 'ORDERS-OPEN' and status = 'new' and public.is_admin())
    )
  );

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update
  using (public.is_admin() or (user_id = auth.uid() and slot = 'ORDERS-OPEN'))
  with check (public.is_admin() or (user_id = auth.uid() and slot = 'ORDERS-OPEN'));
