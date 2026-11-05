-- Per-product daily limits: the most of a product a store makes for one pickup/delivery day
-- (e.g. 10 tabs of macaroons). Checkout only offers days with room, and the server re-checks on order.
--
-- store.products.daily_limit  Max quantity per pickup/delivery day, or null for no limit.
-- store.booked_qty()          How many of each product are already booked per day (Manila dates):
--                             website orders from the moment they're placed, plus walk-in, phone and
--                             Messenger orders. Cancelled, denied, rejected and expired orders don't count.

alter table store.products add column if not exists daily_limit int check (daily_limit > 0);

create or replace function store.booked_qty(p_store uuid, p_from date, p_to date)
returns table (sku text, day date, qty bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    -- Website orders, counted on the website side so they count the moment they're placed
    -- (they reach ops.orders a few seconds later through the webhook).
    select i.value ->> 'sku' as sku,
           (w.scheduled_for at time zone 'Asia/Manila')::date as day,
           (i.value ->> 'qty')::int as qty
    from store.web_orders w
    cross join lateral jsonb_array_elements(coalesce(w."order" -> 'items', '[]'::jsonb)) as i (value)
    where w.store_id = p_store
      and w.status not in ('denied', 'rejected', 'cancelled', 'expired')
      and (w.scheduled_for at time zone 'Asia/Manila')::date between p_from and p_to

    union all

    -- Orders staff enter themselves (walk-in, phone, Messenger).
    select oi.sku,
           (o.scheduled_for at time zone 'Asia/Manila')::date,
           oi.qty
    from ops.orders o
    join ops.order_items oi on oi.order_id = o.id
    where o.store_id = p_store
      and o.source <> 'web'
      and o.status not in ('denied', 'rejected', 'cancelled', 'expired')
      and (o.scheduled_for at time zone 'Asia/Manila')::date between p_from and p_to
  )
  select sku, day, sum(qty)::bigint from lines where sku is not null group by sku, day;
$$;

-- Totals only (no customer details), so the public menu and checkout can show what's left.
grant execute on function store.booked_qty(uuid, date, date) to anon, authenticated;
