-- Multi-store: every menu, setting, customer and order belongs to a store, served at /s/<slug>.
-- Existing data becomes the "weekendfoodhub" store; the Sweet Treats by Yang sub-brand
-- (20261103000021_brands.sql) becomes its own "treatsbyyang" store, and sub-brands are removed.
--
-- Staff belong to stores (ops.staff_users is per store); super admins (ops.super_admins) manage every
-- store. Every row-level security policy in the store and ops schemas is recreated to check the row's
-- store, so one store's staff can't see or change another store's data.

-- ── Stores ────────────────────────────────────────────────────────────────────

create table store.stores (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null,
  tagline    text,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stores_touch before update on store.stores
  for each row execute function public.touch_updated_at();

insert into store.stores (slug, name, tagline, sort_order)
values ('weekendfoodhub', 'Weekend Food Hub', 'Chaofan, silog, paluto and frozen food · Tapilon, Daanbantayan', 1);

insert into store.stores (slug, name, tagline, sort_order)
select 'treatsbyyang', coalesce(b.name, 'Sweet Treats by Yang'), coalesce(b.tagline, 'Made-to-order cakes and pastries'), 2
from (select 1) x
left join store.brands b on b.name = 'Sweet Treats by Yang';

-- ── store_id on every store-owned table (existing rows → Weekend Food Hub) ──

do $$
declare
  t text;
  wfh uuid := (select id from store.stores where slug = 'weekendfoodhub');
begin
  foreach t in array array[
    'store.categories', 'store.products', 'store.modifier_groups', 'store.ingredients', 'store.barangays',
    'store.store_settings', 'store.delivery_settings', 'store.store_hours', 'store.store_closures',
    'store.customers', 'store.promotions', 'store.web_orders',
    'ops.orders', 'ops.staff_users', 'ops.queue_counters', 'ops.inventory_items', 'ops.printers',
    'ops.label_templates', 'ops.sms_settings', 'ops.sms_log', 'ops.menu_snapshots'
  ] loop
    execute format('alter table %s add column store_id uuid references store.stores (id)', t);
    execute format('update %s set store_id = %L', t, wfh);
    execute format('alter table %s alter column store_id set not null', t);
  end loop;
end;
$$;

create index categories_store_idx on store.categories (store_id);
create index products_store_idx on store.products (store_id);
create index modifier_groups_store_idx on store.modifier_groups (store_id);
create index ingredients_store_idx on store.ingredients (store_id);
create index promotions_store_idx on store.promotions (store_id);
create index web_orders_store_idx on store.web_orders (store_id, created_at desc);
create index orders_store_idx on ops.orders (store_id, status, scheduled_for);

-- Single-row settings tables become one row per store.
alter table store.store_settings drop constraint store_settings_pkey, drop column id, add primary key (store_id);
alter table store.delivery_settings drop constraint delivery_settings_pkey, drop column id, add primary key (store_id);
alter table ops.sms_settings drop constraint sms_settings_pkey, drop column id, add primary key (store_id);

alter table store.store_hours drop constraint store_hours_pkey, add primary key (store_id, day_of_week);
alter table store.store_closures drop constraint store_closures_pkey, add primary key (store_id, date);
alter table ops.queue_counters drop constraint queue_counters_pkey, add primary key (store_id, queue_date);
alter table ops.orders drop constraint orders_queue_date_queue_code_key, add unique (store_id, queue_date, queue_code);

-- Names are unique within a store. SKUs and ingredient keys stay unique across all stores
-- (stock, sold-out overrides and daily ingredient status are keyed by them).
alter table store.categories drop constraint categories_name_key, add unique (store_id, name);
alter table store.barangays drop constraint barangays_name_key, add unique (store_id, name);
alter table store.promotions drop constraint promotions_code_key, add unique (store_id, code);
alter table ops.inventory_items drop constraint inventory_items_name_key, add unique (store_id, name);

-- Customer accounts are separate per store: one Facebook login makes one customer per store.
alter table store.customers
  drop constraint customers_user_id_key,
  drop constraint customers_facebook_id_key,
  add unique (store_id, user_id),
  add unique (store_id, facebook_id);

-- People can work in several stores, with a role in each.
alter table ops.staff_users drop constraint staff_users_pkey, add primary key (user_id, store_id);

-- Store-level advance notice (made-to-order cakes); products can override it.
alter table store.store_settings add column notice_days int not null default 0 check (notice_days between 0 and 60);
-- Lets a store run pickup-only.
alter table store.delivery_settings add column delivery_enabled boolean not null default true;

-- ── Sweet Treats by Yang: its own store ───────────────────────────────────────

do $$
declare
  wfh uuid := (select id from store.stores where slug = 'weekendfoodhub');
  sty uuid := (select id from store.stores where slug = 'treatsbyyang');
  g record;
  new_group uuid;
begin
  -- Categories that belonged to the brand, and their products.
  update store.categories c set store_id = sty
   where c.brand_id = (select id from store.brands where name = 'Sweet Treats by Yang');
  update store.products p set store_id = sty
   where p.category_id in (select id from store.categories where store_id = sty);

  -- Add-on groups used by her products: move a group only her products use; copy one shared with WFH.
  for g in
    select distinct pmg.group_id
    from store.product_modifier_groups pmg
    join store.products p on p.id = pmg.product_id
    where p.store_id = sty
  loop
    if exists (
      select 1 from store.product_modifier_groups pmg join store.products p on p.id = pmg.product_id
      where pmg.group_id = g.group_id and p.store_id <> sty
    ) then
      insert into store.modifier_groups (name, required, min_select, max_select, sort_order, store_id)
      select name, required, min_select, max_select, sort_order, sty from store.modifier_groups where id = g.group_id
      returning id into new_group;
      insert into store.modifiers (group_id, name, price_delta, requires_cooking, sort_order, active)
      select new_group, name, price_delta, requires_cooking, sort_order, active from store.modifiers where group_id = g.group_id;
      update store.product_modifier_groups pmg set group_id = new_group
        from store.products p
       where p.id = pmg.product_id and p.store_id = sty and pmg.group_id = g.group_id;
    else
      update store.modifier_groups set store_id = sty where id = g.group_id;
    end if;
  end loop;

  -- "Show only with" conditions on her products must point at her own options: the same-named option
  -- of the same-named group in her store, or no condition.
  update store.product_modifier_groups pmg
     set show_when_modifier_id = (
       select m2.id
       from store.modifiers m1
       join store.modifier_groups g1 on g1.id = m1.group_id
       join store.modifier_groups g2 on g2.store_id = sty and g2.name = g1.name
       join store.modifiers m2 on m2.group_id = g2.id and m2.name = m1.name
       where m1.id = pmg.show_when_modifier_id
       limit 1
     )
    from store.products p
   where p.id = pmg.product_id and p.store_id = sty and pmg.show_when_modifier_id is not null
     and (select mg.store_id from store.modifiers m join store.modifier_groups mg on mg.id = m.group_id
          where m.id = pmg.show_when_modifier_id) <> sty;

  -- Her own settings: 2 days' notice, pre-orders on, times from opening to closing.
  insert into store.store_settings (
    store_id, ordering_paused, allow_preorders, prep_lead_minutes, delivery_buffer_minutes, uncertain_items_cutoff,
    customer_decision_minutes, unpaid_flag_minutes, slot_start_offset_minutes, slot_end_offset_minutes, notice_days
  )
  select sty, false, true, 0, s.delivery_buffer_minutes, s.uncertain_items_cutoff,
         s.customer_decision_minutes, s.unpaid_flag_minutes, 0, 0,
         coalesce((select notice_days from store.brands where name = 'Sweet Treats by Yang'), 2)
  from store.store_settings s where s.store_id = wfh;

  -- Pickup and delivery 8:00 AM – 8:00 PM every day (she can change it).
  insert into store.store_hours (store_id, day_of_week, opens_at, closes_at, is_open)
  select sty, d, '08:00', '20:00', true from generate_series(0, 6) d;

  -- Same fee formula and service area to start from, but delivery off until she sets her kitchen pin.
  insert into store.delivery_settings (
    store_id, base_fee, included_km, per_km, round_to, min_fee, max_km, free_delivery_threshold,
    service_area_geojson, excluded_areas_geojson, rider_share_percent, rider_min_pay, delivery_enabled
  )
  select sty, base_fee, included_km, per_km, round_to, min_fee, max_km, null,
         service_area_geojson, excluded_areas_geojson, rider_share_percent, rider_min_pay, false
  from store.delivery_settings where store_id = wfh;

  insert into store.barangays (store_id, name, active, center_lat, center_lng, is_island, notes, sort_order)
  select sty, name, active, center_lat, center_lng, is_island, notes, sort_order
  from store.barangays where store_id = wfh;

  insert into ops.sms_settings (store_id, enabled) values (sty, false);
end;
$$;

-- ── Sub-brands are replaced by stores ─────────────────────────────────────────

alter table store.categories drop column brand_id;
alter table ops.order_items drop column brand;
drop table store.brands;

-- ── Super admins and per-store roles ──────────────────────────────────────────

create table ops.super_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table ops.super_admins enable row level security;
create policy "read own row" on ops.super_admins for select to authenticated using (user_id = (select auth.uid()));

-- Existing owners become super admins (they ran the single-store setup).
insert into ops.super_admins (user_id) select user_id from ops.staff_users where role = 'owner' and active;

create or replace function ops.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from ops.super_admins where user_id = (select auth.uid()));
$$;

-- The signed-in person's role in a store (super admins count as owners everywhere).
create or replace function ops.store_role(p_store uuid)
returns ops.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when ops.is_super_admin() then 'owner'::ops.staff_role
    else (select role from ops.staff_users where user_id = (select auth.uid()) and store_id = p_store and active)
  end;
$$;

create or replace function ops.has_store_role(p_store uuid, variadic roles ops.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ops.store_role(p_store) = any (roles), false);
$$;

-- Staff who work orders in a store (everyone but riders, who only see their own deliveries).
create or replace function ops.is_store_staff(p_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ops.store_role(p_store) <> 'rider', false);
$$;

-- Staff in any store (personal rows such as push devices).
create or replace function ops.is_any_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ops.is_super_admin() or exists (select 1 from ops.staff_users where user_id = (select auth.uid()) and active);
$$;

-- Store of a product SKU or ingredient key (stock, overrides and daily status are keyed by them).
create or replace function ops.sku_store(p_sku text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select store_id from store.products where sku = p_sku;
$$;

create or replace function ops.ingredient_store(p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select store_id from store.ingredients where key = p_key;
$$;

grant execute on function
  ops.is_super_admin(), ops.store_role(uuid), ops.has_store_role(uuid, ops.staff_role[]), ops.is_store_staff(uuid),
  ops.is_any_staff(), ops.sku_store(text), ops.ingredient_store(text)
to anon, authenticated;

-- ── Row-level security: drop every policy, recreate them per store ────────────

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname in ('store', 'ops') loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- The single-store helpers are replaced by the ones above (nothing uses them once the policies are gone).
drop function ops.has_role(ops.staff_role[]);
drop function ops.is_staff();
drop function ops.current_staff_role();

alter table store.stores enable row level security;
create policy "public read" on store.stores for select to anon, authenticated using (true);
create policy "super admin manages" on store.stores
  for all to authenticated using (ops.is_super_admin()) with check (ops.is_super_admin());
create policy "owner updates own store" on store.stores
  for update to authenticated using (ops.has_store_role(id, 'owner')) with check (ops.has_store_role(id, 'owner'));

-- Catalog and config with their own store_id: anyone reads, the store's owner edits.
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'products', 'modifier_groups', 'ingredients', 'barangays', 'delivery_settings', 'store_hours',
    'store_closures', 'store_settings'
  ] loop
    execute format('create policy "public read" on store.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "owner writes" on store.%I for all to authenticated using (ops.has_store_role(store_id, ''owner'')) with check (ops.has_store_role(store_id, ''owner''))',
      t
    );
  end loop;
end;
$$;

-- Catalog child tables follow their parent's store.
create policy "public read" on store.modifiers for select to anon, authenticated using (true);
create policy "owner writes" on store.modifiers for all to authenticated
  using (ops.has_store_role((select store_id from store.modifier_groups g where g.id = group_id), 'owner'))
  with check (ops.has_store_role((select store_id from store.modifier_groups g where g.id = group_id), 'owner'));

create policy "public read" on store.product_modifier_groups for select to anon, authenticated using (true);
create policy "owner writes" on store.product_modifier_groups for all to authenticated
  using (ops.has_store_role((select store_id from store.products p where p.id = product_id), 'owner'))
  with check (ops.has_store_role((select store_id from store.products p where p.id = product_id), 'owner'));

create policy "public read" on store.product_ingredients for select to anon, authenticated using (true);
create policy "owner writes" on store.product_ingredients for all to authenticated
  using (ops.has_store_role((select store_id from store.products p where p.id = product_id), 'owner'))
  with check (ops.has_store_role((select store_id from store.products p where p.id = product_id), 'owner'));

create policy "public read" on store.ingredient_availability for select to anon, authenticated using (true);
create policy "owner writes" on store.ingredient_availability for all to authenticated
  using (ops.has_store_role((select store_id from store.ingredients i where i.id = ingredient_id), 'owner'))
  with check (ops.has_store_role((select store_id from store.ingredients i where i.id = ingredient_id), 'owner'));

-- Customers see and edit their own profile; the store's staff can look its customers up.
create policy "customer reads own" on store.customers for select to authenticated
  using (user_id = (select auth.uid()) or ops.is_store_staff(store_id));
create policy "customer creates own" on store.customers for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "customer updates own" on store.customers for update to authenticated
  using (user_id = (select auth.uid()) or ops.has_store_role(store_id, 'owner'))
  with check (user_id = (select auth.uid()) or ops.has_store_role(store_id, 'owner'));

create policy "customer manages own addresses" on store.customer_addresses for all to authenticated
  using (customer_id in (select id from store.customers where user_id = (select auth.uid())))
  with check (customer_id in (select id from store.customers where user_id = (select auth.uid())));
create policy "staff read addresses" on store.customer_addresses for select to authenticated
  using (ops.is_store_staff((select store_id from store.customers c where c.id = customer_id)));

create policy "customer manages own push subscriptions" on store.push_subscriptions for all to authenticated
  using (customer_id in (select id from store.customers where user_id = (select auth.uid())))
  with check (customer_id in (select id from store.customers where user_id = (select auth.uid())));

-- Welcome/auto promos are visible so the storefront can advertise them; codes stay private.
create policy "public reads advertised promos" on store.promotions for select to anon, authenticated
  using (active and trigger in ('welcome', 'auto'));
create policy "owner manages promos" on store.promotions for all to authenticated
  using (ops.has_store_role(store_id, 'owner')) with check (ops.has_store_role(store_id, 'owner'));

create policy "customer reads own redemptions" on store.promotion_redemptions for select to authenticated
  using (
    customer_id in (select id from store.customers where user_id = (select auth.uid()))
    or ops.has_store_role((select store_id from store.promotions p where p.id = promotion_id), 'owner')
  );

-- Orders are written by the web server (service role); customers and the store's staff read.
create policy "customer reads own orders" on store.web_orders for select to authenticated
  using (
    customer_id in (select id from store.customers where user_id = (select auth.uid()))
    or ops.is_store_staff(store_id)
  );

-- webhook_outbox / webhook_inbox: no policies, service role only.

-- ── ops ───────────────────────────────────────────────────────────────────────

create policy "read own rows" on ops.staff_users for select to authenticated
  using (user_id = (select auth.uid()) or ops.has_store_role(store_id, 'owner'));
create policy "owner manages staff" on ops.staff_users for all to authenticated
  using (ops.has_store_role(store_id, 'owner')) with check (ops.has_store_role(store_id, 'owner'));

create policy "staff read" on ops.orders for select to authenticated using (ops.is_store_staff(store_id));
create policy "staff insert" on ops.orders for insert to authenticated with check (ops.is_store_staff(store_id));
create policy "staff update" on ops.orders for update to authenticated
  using (ops.is_store_staff(store_id)) with check (ops.is_store_staff(store_id));
create policy "rider reads own deliveries" on ops.orders for select to authenticated
  using (ops.has_store_role(store_id, 'rider') and rider_id = (select auth.uid()));
create policy "rider updates own deliveries" on ops.orders for update to authenticated
  using (ops.has_store_role(store_id, 'rider') and rider_id = (select auth.uid()))
  with check (ops.has_store_role(store_id, 'rider') and rider_id = (select auth.uid()));

-- Order child tables follow the order's store.
create policy "staff read" on ops.order_items for select to authenticated
  using (ops.is_store_staff((select store_id from ops.orders o where o.id = order_id)));
create policy "staff insert" on ops.order_items for insert to authenticated
  with check (ops.is_store_staff((select store_id from ops.orders o where o.id = order_id)));
create policy "staff update" on ops.order_items for update to authenticated
  using (ops.is_store_staff((select store_id from ops.orders o where o.id = order_id)))
  with check (ops.is_store_staff((select store_id from ops.orders o where o.id = order_id)));

create policy "rider reads own delivery items" on ops.order_items for select to authenticated
  using (exists (
    select 1 from ops.orders o
    where o.id = order_id and o.rider_id = (select auth.uid()) and ops.has_store_role(o.store_id, 'rider')
  ));

create policy "staff read" on ops.order_item_availability for select to authenticated
  using (ops.is_store_staff((select o.store_id from ops.order_items i join ops.orders o on o.id = i.order_id where i.id = order_item_id)));
create policy "staff insert" on ops.order_item_availability for insert to authenticated
  with check (ops.is_store_staff((select o.store_id from ops.order_items i join ops.orders o on o.id = i.order_id where i.id = order_item_id)));
create policy "staff update" on ops.order_item_availability for update to authenticated
  using (ops.is_store_staff((select o.store_id from ops.order_items i join ops.orders o on o.id = i.order_id where i.id = order_item_id)))
  with check (ops.is_store_staff((select o.store_id from ops.order_items i join ops.orders o on o.id = i.order_id where i.id = order_item_id)));

create policy "staff read" on ops.order_events for select to authenticated
  using (ops.is_store_staff((select store_id from ops.orders o where o.id = order_id)));

create policy "verifiers read" on ops.payment_verifications for select to authenticated
  using (ops.is_store_staff((select store_id from ops.orders o where o.id = order_id)));
create policy "verifiers decide" on ops.payment_verifications for insert to authenticated
  with check (
    ops.has_store_role((select store_id from ops.orders o where o.id = order_id), 'owner', 'verifier')
    and verified_by = (select auth.uid())
  );

-- Stock, sold-out overrides and daily ingredient status follow the product's / ingredient's store.
do $$
declare t text;
begin
  foreach t in array array['product_stock', 'product_overrides'] loop
    execute format('create policy "staff read" on ops.%I for select to authenticated using (ops.is_store_staff(ops.sku_store(sku)))', t);
    execute format('create policy "staff insert" on ops.%I for insert to authenticated with check (ops.is_store_staff(ops.sku_store(sku)))', t);
    execute format(
      'create policy "staff update" on ops.%I for update to authenticated using (ops.is_store_staff(ops.sku_store(sku))) with check (ops.is_store_staff(ops.sku_store(sku)))',
      t
    );
  end loop;
end;
$$;

create policy "staff read" on ops.stock_movements for select to authenticated using (ops.is_store_staff(ops.sku_store(sku)));
create policy "staff insert" on ops.stock_movements for insert to authenticated with check (ops.is_store_staff(ops.sku_store(sku)));

create policy "staff read" on ops.ingredient_daily_status for select to authenticated
  using (ops.is_store_staff(ops.ingredient_store(ingredient_key)));
create policy "staff insert" on ops.ingredient_daily_status for insert to authenticated
  with check (ops.is_store_staff(ops.ingredient_store(ingredient_key)));
create policy "staff update" on ops.ingredient_daily_status for update to authenticated
  using (ops.is_store_staff(ops.ingredient_store(ingredient_key)))
  with check (ops.is_store_staff(ops.ingredient_store(ingredient_key)));

create policy "staff read" on ops.menu_snapshots for select to authenticated using (ops.is_store_staff(store_id));

do $$
declare t text;
begin
  foreach t in array array['printers', 'label_templates', 'inventory_items'] loop
    execute format('create policy "staff read" on ops.%I for select to authenticated using (ops.is_store_staff(store_id))', t);
    execute format(
      'create policy "owner manages" on ops.%I for all to authenticated using (ops.has_store_role(store_id, ''owner'')) with check (ops.has_store_role(store_id, ''owner''))',
      t
    );
  end loop;
end;
$$;

create policy "staff read" on ops.inventory_counts for select to authenticated
  using (ops.is_store_staff((select store_id from ops.inventory_items i where i.id = item_id)));
create policy "staff insert" on ops.inventory_counts for insert to authenticated
  with check (ops.is_store_staff((select store_id from ops.inventory_items i where i.id = item_id)));
create policy "staff update" on ops.inventory_counts for update to authenticated
  using (ops.is_store_staff((select store_id from ops.inventory_items i where i.id = item_id)))
  with check (ops.is_store_staff((select store_id from ops.inventory_items i where i.id = item_id)));

create policy "owner manages" on ops.sms_settings for all to authenticated
  using (ops.has_store_role(store_id, 'owner')) with check (ops.has_store_role(store_id, 'owner'));
create policy "owner reads" on ops.sms_log for select to authenticated using (ops.has_store_role(store_id, 'owner'));

create policy "staff manage own push tokens" on ops.staff_push_tokens for all to authenticated
  using (user_id = (select auth.uid()) and ops.is_any_staff())
  with check (user_id = (select auth.uid()) and ops.is_any_staff());
create policy "staff manage own devices" on ops.staff_web_push for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and ops.is_any_staff());

-- queue_counters, webhook_inbox, webhook_outbox: no policies (functions and service role only).

-- ── Order functions, per store ────────────────────────────────────────────────

drop function ops.next_queue_code(date);

-- Daily queue codes (A-001, A-002, …) per store, reset each Manila calendar day.
create or replace function ops.next_queue_code(p_store uuid, p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into ops.queue_counters as q (store_id, queue_date, last_number)
  values (p_store, p_date, 1)
  on conflict (store_id, queue_date) do update set last_number = q.last_number + 1
  returning last_number into n;
  return 'A-' || lpad(n::text, 3, '0');
end;
$$;

create or replace function ops.assign_queue_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Codes are per store and Manila calendar day of the pickup/delivery time.
  new.queue_date := (new.scheduled_for at time zone 'Asia/Manila')::date;
  if coalesce(new.queue_code, '') = '' then
    new.queue_code := ops.next_queue_code(new.store_id, new.queue_date);
  end if;
  return new;
end;
$$;

create or replace function ops.complete_availability_check(p_order_id uuid, p_decision_minutes int default 30)
returns ops.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order ops.orders;
  v_pending int;
  v_available int;
  v_changed boolean;
  v_status ops.order_status;
  v_items jsonb;
begin
  select * into v_order from ops.orders where id = p_order_id for update;

  if not (ops.has_store_role(v_order.store_id, 'owner', 'verifier', 'kitchen', 'counter') or (select auth.role()) = 'service_role') then
    raise exception 'not allowed';
  end if;

  if v_order.status <> 'awaiting_availability' then
    raise exception 'order % is not awaiting availability', v_order.queue_code;
  end if;

  select count(*) filter (where a.status = 'pending'),
         count(*) filter (where coalesce(a.status, 'ready_to_cook') = 'ready_to_cook'),
         bool_or(a.status = 'cant_source' or (i.price_mode = 'market' and a.final_unit_price is distinct from i.estimated_unit_price))
    into v_pending, v_available, v_changed
  from ops.order_items i
  left join ops.order_item_availability a on a.order_item_id = i.id
  where i.order_id = p_order_id;

  if v_pending > 0 then
    raise exception '% item(s) still need a result', v_pending;
  end if;

  -- Market items get their confirmed price.
  update ops.order_items i
     set unit_price = a.final_unit_price
    from ops.order_item_availability a
   where a.order_item_id = i.id and i.order_id = p_order_id and a.final_unit_price is not null;

  if v_available = 0 then
    v_status := 'denied';
  elsif coalesce(v_changed, false) then
    v_status := 'awaiting_customer';
  else
    v_status := 'pending_payment';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'lineId', a.order_item_id,
           'status', a.status,
           'finalUnitPrice', a.final_unit_price,
           'substituteSku', a.substitute_sku,
           'note', a.note)), '[]'::jsonb)
    into v_items
  from ops.order_item_availability a
  join ops.order_items i on i.id = a.order_item_id
  where i.order_id = p_order_id;

  -- Send the result before the status change so the website has the details first.
  if v_order.external_id is not null then
    perform ops.enqueue_web_event('order.availability_result', jsonb_build_object(
      'orderId', v_order.external_id,
      'items', v_items,
      'requiresCustomerDecision', v_status = 'awaiting_customer'
    ));
  end if;

  update ops.orders
     set status = v_status,
         payment_status = case when v_status = 'pending_payment' then 'awaiting_payment' else payment_status end,
         decision_deadline = case when v_status = 'awaiting_customer' then now() + make_interval(mins => p_decision_minutes) end
   where id = p_order_id;

  return v_status;
end;
$$;

create or replace function ops.review_payment(
  p_order_id uuid,
  p_decision ops.payment_decision,
  p_amount_received numeric default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order ops.orders;
  v_actor uuid := (select auth.uid());
begin
  select * into v_order from ops.orders where id = p_order_id for update;

  if not ops.has_store_role(v_order.store_id, 'owner', 'verifier') and (select auth.role()) <> 'service_role' then
    raise exception 'only the owner or a verifier can review payments';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'order % is not waiting for payment', v_order.queue_code;
  end if;

  insert into ops.payment_verifications (order_id, decision, reference_no, sender_name, amount_received, reason, verified_by)
  values (p_order_id, p_decision, v_order.payment_reference_no, v_order.payment_sender_name, p_amount_received, p_reason,
          coalesce(v_actor,
            (select user_id from ops.staff_users where role = 'owner' and store_id = v_order.store_id order by created_at limit 1),
            (select user_id from ops.super_admins order by created_at limit 1)));

  if v_order.external_id is not null then
    if p_decision = 'confirmed' then
      perform ops.enqueue_web_event('order.payment_confirmed', jsonb_build_object(
        'orderId', v_order.external_id, 'amountReceived', p_amount_received, 'referenceNo', v_order.payment_reference_no));
    elsif p_decision = 'rejected' then
      perform ops.enqueue_web_event('order.payment_rejected', jsonb_build_object(
        'orderId', v_order.external_id, 'reason', p_reason));
    end if;
  end if;

  update ops.orders
     set payment_status = case p_decision when 'confirmed' then 'confirmed' when 'partial' then 'partial' else 'rejected' end::ops.payment_status,
         status = case p_decision when 'confirmed' then 'queued' when 'rejected' then 'rejected' else status end::ops.order_status,
         notes = case when p_decision = 'partial' then concat_ws(E'\n', notes, 'Partial payment: ' || coalesce(p_reason, '')) else notes end
   where id = p_order_id;
end;
$$;

-- Timers run by the web server's worker every minute; each store's own unpaid-flag delay applies.
create or replace function ops.run_timers(p_unpaid_flag_minutes int default 30)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update ops.orders
     set status = 'expired', customer_decision = 'expired'
   where status = 'awaiting_customer' and decision_deadline < now();

  update ops.orders o
     set flags = array_append(o.flags, 'unpaid_overdue')
    from store.store_settings s
   where s.store_id = o.store_id
     and o.status = 'pending_payment'
     and o.payment_status in ('awaiting_payment', 'not_requested')
     and not ('unpaid_overdue' = any (o.flags))
     and o.updated_at < now() - make_interval(mins => coalesce(s.unpaid_flag_minutes, p_unpaid_flag_minutes));
end;
$$;

revoke execute on function ops.run_timers(int) from anon, authenticated;
revoke execute on function ops.next_queue_code(uuid, date) from anon, authenticated;

-- New tables are created by whichever role runs this file; make sure the API roles can reach them.
grant all on table store.stores to anon, authenticated, service_role;
grant all on table ops.super_admins to authenticated, service_role;
