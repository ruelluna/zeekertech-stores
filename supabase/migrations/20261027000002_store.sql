-- store schema: menu, delivery config, store hours, customers, promotions, web orders.
-- Keep enum values in sync with packages/shared/src/enums.ts.

create type store.product_type as enum ('made_to_order', 'ready_made', 'frozen', 'bundle');
create type store.price_mode as enum ('fixed', 'market');
create type store.sold_by as enum ('unit', 'weight');
create type store.availability_mode as enum ('always', 'subject_to_availability');
create type store.daily_status as enum ('available', 'out', 'unknown');
create type store.fulfillment as enum ('pickup', 'delivery');
create type store.order_status as enum (
  'received', 'awaiting_availability', 'awaiting_customer', 'pending_payment', 'queued', 'preparing',
  'ready', 'out_for_delivery', 'delivered', 'picked_up', 'completed', 'denied', 'rejected', 'cancelled',
  'expired'
);
create type store.payment_method as enum ('gcash', 'cash');
create type store.payment_status as enum (
  'not_requested', 'awaiting_payment', 'submitted', 'partial', 'confirmed', 'rejected'
);
create type store.customer_decision as enum ('continue', 'cancel', 'expired');
create type store.promotion_type as enum ('fixed', 'percent');
create type store.promotion_trigger as enum ('welcome', 'code', 'auto');
create type store.webhook_status as enum ('pending', 'sent', 'failed');

-- ── Menu ──────────────────────────────────────────────────────────────────────

create table store.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store.products (
  id                uuid primary key default gen_random_uuid(),
  sku               text not null unique check (sku ~ '^[A-Z0-9-]+$'),
  name              text not null,
  description       text,
  category_id       uuid not null references store.categories (id),
  type              store.product_type not null,
  price_mode        store.price_mode not null default 'fixed',
  -- Fixed price, or price per kg when sold_by = 'weight'. Null until the owner sets it;
  -- products without a price can't be ordered.
  price             numeric(10, 2) check (price >= 0),
  estimated_price   numeric(10, 2) check (estimated_price >= 0),
  sold_by           store.sold_by not null default 'unit',
  weight_options_kg numeric(5, 2)[] not null default '{}',
  prep_minutes      int check (prep_minutes >= 0),
  stock_tracked     boolean not null default false,
  image_url         text,
  sort_order        int not null default 0,
  active            boolean not null default true,
  -- Mirrored from ops (sold-out toggle and stock count) so the storefront can show badges.
  sold_out          boolean not null default false,
  stock_qty         int check (stock_qty >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (sold_by = 'unit' or cardinality(weight_options_kg) > 0)
);

create index products_category_idx on store.products (category_id);

create table store.modifier_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  required   boolean not null default false,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_select <= max_select)
);

create table store.modifiers (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references store.modifier_groups (id) on delete cascade,
  name             text not null,
  -- Null until priced; options without a price aren't offered.
  price_delta      numeric(10, 2) check (price_delta >= 0),
  requires_cooking boolean not null default false,
  sort_order       int not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (group_id, name)
);

create table store.product_modifier_groups (
  product_id uuid not null references store.products (id) on delete cascade,
  group_id   uuid not null references store.modifier_groups (id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, group_id)
);

create table store.ingredients (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique check (key ~ '^[a-z0-9_]+$'),
  name                 text not null,
  unit                 text,
  availability_mode    store.availability_mode not null default 'always',
  default_wait_minutes int check (default_wait_minutes > 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table store.product_ingredients (
  product_id    uuid not null references store.products (id) on delete cascade,
  ingredient_id uuid not null references store.ingredients (id) on delete cascade,
  is_key        boolean not null default true,
  primary key (product_id, ingredient_id)
);

-- Mirrored from ops.ingredient_daily_status for storefront badges.
create table store.ingredient_availability (
  ingredient_id uuid not null references store.ingredients (id) on delete cascade,
  date          date not null,
  status        store.daily_status not null default 'unknown',
  qty_available numeric(10, 2),
  market_price  numeric(10, 2),
  updated_at    timestamptz not null default now(),
  primary key (ingredient_id, date)
);

-- ── Delivery and store hours ──────────────────────────────────────────────────

create table store.barangays (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  active       boolean not null default true,
  center_lat   double precision,
  center_lng   double precision,
  fee_override numeric(10, 2) check (fee_override >= 0),
  surcharge    numeric(10, 2) check (surcharge >= 0),
  is_island    boolean not null default false,
  notes        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Single-row tables use a boolean primary key that can only be true.
create table store.delivery_settings (
  id                      boolean primary key default true check (id),
  kitchen_address         text,
  kitchen_lat             double precision,
  kitchen_lng             double precision,
  base_fee                numeric(10, 2) not null default 30,
  included_km             numeric(5, 2) not null default 2,
  per_km                  numeric(10, 2) not null default 10,
  round_to                numeric(10, 2) not null default 5 check (round_to > 0),
  min_fee                 numeric(10, 2) not null default 30,
  max_km                  numeric(5, 2) not null default 25,
  free_delivery_threshold numeric(10, 2),
  -- Mainland Daanbantayan boundary with islands removed (GeoJSON Polygon/MultiPolygon).
  service_area_geojson    jsonb,
  updated_at              timestamptz not null default now()
);

create table store.store_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  opens_at    time not null,
  closes_at   time not null,
  is_open     boolean not null default true,
  check (opens_at < closes_at)
);

create table store.store_closures (
  date   date primary key,
  reason text
);

create table store.store_settings (
  id                        boolean primary key default true check (id),
  ordering_paused           boolean not null default false,
  allow_preorders           boolean not null default true,
  prep_lead_minutes         int not null default 30,
  delivery_buffer_minutes   int not null default 10,
  uncertain_items_cutoff    time not null default '20:00',
  customer_decision_minutes int not null default 30,
  unpaid_flag_minutes       int not null default 30,
  gcash_qr_url              text,
  gcash_account_name        text,
  pickup_instructions       text,
  updated_at                timestamptz not null default now()
);

-- ── Customers ─────────────────────────────────────────────────────────────────

create table store.customers (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid unique references auth.users (id) on delete set null,
  facebook_id             text unique,
  name                    text not null,
  email                   text,
  avatar_url              text,
  phone                   text check (phone ~ '^09[0-9]{9}$'),
  phone_verified          boolean not null default false,
  is_registered           boolean not null default false,
  privacy_consent_at      timestamptz,
  merged_into_customer_id uuid references store.customers (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index customers_phone_idx on store.customers (phone);

create table store.customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references store.customers (id) on delete cascade,
  label        text not null default 'Home',
  barangay_id  uuid not null references store.barangays (id),
  street_purok text not null default '',
  landmark     text not null default '',
  lat          double precision not null,
  lng          double precision not null,
  rider_notes  text not null default '',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index customer_addresses_one_default on store.customer_addresses (customer_id) where is_default;

create table store.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references store.customers (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ── Promotions ────────────────────────────────────────────────────────────────

create table store.promotions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  type               store.promotion_type not null,
  value              numeric(10, 2) not null check (value > 0),
  max_discount       numeric(10, 2),
  min_order          numeric(10, 2),
  trigger            store.promotion_trigger not null,
  code               text unique,
  per_customer_limit int not null default 1 check (per_customer_limit > 0),
  -- For welcome promos: days after registering that the discount stays valid.
  valid_days         int check (valid_days > 0),
  starts_at          timestamptz,
  ends_at            timestamptz,
  active             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (trigger <> 'code' or code is not null),
  check (type <> 'percent' or value <= 100)
);

-- ── Web orders ────────────────────────────────────────────────────────────────

create sequence store.web_order_number start 10001;

create table store.web_orders (
  id                  uuid primary key default gen_random_uuid(),
  order_code          text not null unique default 'WEB-' || nextval('store.web_order_number'),
  customer_id         uuid references store.customers (id),
  -- Secret in the guest's order-status link; the server looks the order up with it.
  access_token        uuid not null unique default gen_random_uuid(),
  fulfillment         store.fulfillment not null,
  scheduled_for       timestamptz not null,
  status              store.order_status not null default 'received',
  payment_status      store.payment_status not null default 'not_requested',
  customer_decision   store.customer_decision,
  subtotal            numeric(10, 2) not null,
  discount_amount     numeric(10, 2) not null default 0,
  delivery_fee        numeric(10, 2) not null default 0,
  total               numeric(10, 2) not null,
  is_estimate         boolean not null default false,
  -- Full WebOrder payload as sent in order.created (packages/shared/src/orders.ts).
  "order"             jsonb not null,
  availability_result jsonb,
  -- GCash reference no., sender name, amount and proof path submitted by the customer.
  payment_submission  jsonb,
  status_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index web_orders_customer_idx on store.web_orders (customer_id, created_at desc);

create table store.promotion_redemptions (
  id           uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references store.promotions (id),
  customer_id  uuid not null references store.customers (id),
  web_order_id uuid not null references store.web_orders (id),
  amount       numeric(10, 2) not null,
  created_at   timestamptz not null default now()
);

create index promotion_redemptions_customer_idx on store.promotion_redemptions (customer_id, promotion_id);

-- ── Webhooks (web side) ───────────────────────────────────────────────────────

create table store.webhook_outbox (
  id              bigint generated always as identity primary key,
  event_id        text not null unique,
  event_type      text not null,
  payload         jsonb not null,
  status          store.webhook_status not null default 'pending',
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index webhook_outbox_due_idx on store.webhook_outbox (next_attempt_at) where status = 'pending';

create table store.webhook_inbox (
  event_id     text primary key,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);

-- ── updated_at triggers ───────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'products', 'modifier_groups', 'modifiers', 'ingredients', 'barangays',
    'delivery_settings', 'store_settings', 'customers', 'customer_addresses', 'promotions', 'web_orders',
    'ingredient_availability'
  ] loop
    execute format(
      'create trigger %I before update on store.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end;
$$;

-- ── Row-level security ────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'products', 'modifier_groups', 'modifiers', 'product_modifier_groups', 'ingredients',
    'product_ingredients', 'ingredient_availability', 'barangays', 'delivery_settings', 'store_hours',
    'store_closures', 'store_settings', 'customers', 'customer_addresses', 'push_subscriptions',
    'promotions', 'web_orders', 'promotion_redemptions', 'webhook_outbox', 'webhook_inbox'
  ] loop
    execute format('alter table store.%I enable row level security', t);
  end loop;
end;
$$;

-- Public catalog and config: anyone can read, the owner edits (web admin).
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'products', 'modifier_groups', 'modifiers', 'product_modifier_groups', 'ingredients',
    'product_ingredients', 'ingredient_availability', 'barangays', 'delivery_settings', 'store_hours',
    'store_closures', 'store_settings'
  ] loop
    execute format('create policy "public read" on store.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "owner writes" on store.%I for all to authenticated using (ops.has_role(''owner'')) with check (ops.has_role(''owner''))',
      t
    );
  end loop;
end;
$$;

-- Customers see and edit their own profile; staff can look customers up.
create policy "customer reads own" on store.customers
  for select to authenticated
  using (user_id = (select auth.uid()) or ops.is_staff());

create policy "customer creates own" on store.customers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "customer updates own" on store.customers
  for update to authenticated
  using (user_id = (select auth.uid()) or ops.has_role('owner'))
  with check (user_id = (select auth.uid()) or ops.has_role('owner'));

create policy "customer manages own addresses" on store.customer_addresses
  for all to authenticated
  using (customer_id in (select id from store.customers where user_id = (select auth.uid())))
  with check (customer_id in (select id from store.customers where user_id = (select auth.uid())));

create policy "staff read addresses" on store.customer_addresses
  for select to authenticated
  using (ops.is_staff());

create policy "customer manages own push subscriptions" on store.push_subscriptions
  for all to authenticated
  using (customer_id in (select id from store.customers where user_id = (select auth.uid())))
  with check (customer_id in (select id from store.customers where user_id = (select auth.uid())));

-- Welcome/auto promos are visible so the storefront can advertise them; codes stay private.
create policy "public reads advertised promos" on store.promotions
  for select to anon, authenticated
  using (active and trigger in ('welcome', 'auto'));

create policy "owner manages promos" on store.promotions
  for all to authenticated
  using (ops.has_role('owner'))
  with check (ops.has_role('owner'));

create policy "customer reads own redemptions" on store.promotion_redemptions
  for select to authenticated
  using (
    customer_id in (select id from store.customers where user_id = (select auth.uid()))
    or ops.has_role('owner')
  );

-- Orders are written by the web server (service role); customers and staff read.
create policy "customer reads own orders" on store.web_orders
  for select to authenticated
  using (
    customer_id in (select id from store.customers where user_id = (select auth.uid()))
    or ops.is_staff()
  );

-- webhook_outbox / webhook_inbox: no policies, service role only.

-- ── Realtime (live order status page and availability badges) ─────────────────

alter publication supabase_realtime add table store.web_orders, store.products, store.ingredient_availability;
