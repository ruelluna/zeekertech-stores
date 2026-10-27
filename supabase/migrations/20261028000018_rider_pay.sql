-- Rider pay: a share of each delivery fee (adjustable), saved per order when it goes out.

alter table store.delivery_settings
  add column rider_share_percent numeric(5, 2) not null default 70 check (rider_share_percent between 0 and 100),
  add column rider_min_pay numeric(10, 2) not null default 0 check (rider_min_pay >= 0);

alter table ops.orders
  add column rider_id uuid references auth.users (id) on delete set null,
  -- What the rider earns for this trip, fixed when the order goes out for delivery.
  add column rider_pay numeric(10, 2) check (rider_pay >= 0),
  add column rider_paid_out_at timestamptz;

create index orders_rider_idx on ops.orders (rider_id, status) where rider_id is not null;

-- Riders are staff but only see their own deliveries: they're excluded from is_staff() (which gates
-- every other staff table, customers and web orders) and get their own policies below.
create or replace function ops.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ops.current_staff_role() <> 'rider', false);
$$;

create policy "rider reads own deliveries" on ops.orders
  for select to authenticated
  using (ops.has_role('rider') and rider_id = (select auth.uid()));

create policy "rider updates own deliveries" on ops.orders
  for update to authenticated
  using (ops.has_role('rider') and rider_id = (select auth.uid()))
  with check (ops.has_role('rider') and rider_id = (select auth.uid()));

create policy "rider reads own delivery items" on ops.order_items
  for select to authenticated
  using (
    ops.has_role('rider')
    and exists (select 1 from ops.orders o where o.id = order_id and o.rider_id = (select auth.uid()))
  );
