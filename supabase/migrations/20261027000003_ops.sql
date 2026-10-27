-- ops schema: orders and their progress, sourcing, payment review, stock, printers, webhooks.
-- Keep enum values in sync with packages/shared/src/enums.ts.

create type ops.order_status as enum (
  'received', 'awaiting_availability', 'awaiting_customer', 'pending_payment', 'queued', 'preparing',
  'ready', 'out_for_delivery', 'delivered', 'picked_up', 'completed', 'denied', 'rejected', 'cancelled',
  'expired'
);
create type ops.fulfillment as enum ('pickup', 'delivery');
create type ops.order_source as enum ('web', 'walk_in', 'phone', 'messenger');
create type ops.payment_method as enum ('gcash', 'cash');
create type ops.payment_status as enum (
  'not_requested', 'awaiting_payment', 'submitted', 'partial', 'confirmed', 'rejected'
);
create type ops.payment_decision as enum ('confirmed', 'partial', 'rejected');
create type ops.price_mode as enum ('fixed', 'market');
create type ops.item_availability as enum ('pending', 'ready_to_cook', 'cant_source');
create type ops.item_status as enum ('pending', 'queued', 'ready', 'handed_over', 'removed');
create type ops.daily_status as enum ('available', 'out', 'unknown');
create type ops.distance_method as enum ('road', 'straight_line');
create type ops.fee_source as enum ('formula', 'barangay_override', 'free_threshold', 'manual');
create type ops.customer_decision as enum ('continue', 'cancel', 'expired');
create type ops.stock_reason as enum ('sale', 'restock', 'correction', 'cancel_return');
create type ops.printer_connection as enum ('lan', 'bluetooth', 'usb');
create type ops.printer_language as enum ('escpos', 'tspl', 'zpl');
create type ops.label_kind as enum ('item', 'delivery_slip');
create type ops.webhook_status as enum ('pending', 'sent', 'failed');

-- ── Orders ────────────────────────────────────────────────────────────────────

create table ops.orders (
  id                     uuid primary key default gen_random_uuid(),
  -- Web order code (e.g. WEB-10293); null for walk-in/phone/messenger orders.
  external_id            text unique,
  -- Generated on the device so offline walk-in orders sync without duplicates.
  client_id              uuid unique,
  queue_date             date not null,
  queue_code             text not null,
  source                 ops.order_source not null,
  customer_ref           uuid, -- store.customers.id, when known
  customer_name          text,
  customer_phone         text,
  fulfillment            ops.fulfillment not null,
  scheduled_for          timestamptz not null,
  address                jsonb, -- AddressSnapshot
  barangay               text,
  lat                    double precision,
  lng                    double precision,
  distance_km            numeric(6, 2),
  distance_method        ops.distance_method,
  travel_minutes         int,
  delivery_fee           numeric(10, 2) not null default 0,
  fee_source             ops.fee_source,
  fee_breakdown          jsonb,
  fee_overridden_by      uuid references auth.users (id),
  fee_override_reason    text,
  subtotal               numeric(10, 2) not null default 0,
  discount_amount        numeric(10, 2) not null default 0,
  promotion_ref          uuid,
  total                  numeric(10, 2) not null default 0,
  is_estimate            boolean not null default false,
  status                 ops.order_status not null default 'received',
  payment_method         ops.payment_method,
  payment_status         ops.payment_status not null default 'not_requested',
  payment_reference_no   text,
  payment_sender_name    text,
  payment_amount_claimed numeric(10, 2),
  payment_proof_path     text,
  -- e.g. possible_duplicate_discount, duplicate_reference_no, slot_at_risk, out_of_area
  flags                  text[] not null default '{}',
  availability_deadline  timestamptz,
  decision_deadline      timestamptz,
  customer_decision      ops.customer_decision,
  rider_name             text,
  notes                  text,
  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  out_for_delivery_at    timestamptz,
  completed_at           timestamptz,
  unique (queue_date, queue_code),
  check (fulfillment = 'pickup' or address is not null)
);

create index orders_status_idx on ops.orders (status, scheduled_for);
create index orders_phone_idx on ops.orders (customer_phone);

create table ops.order_items (
  -- Same as the lineId in the webhook payload, so availability results can refer to it.
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references ops.orders (id) on delete cascade,
  sku                  text not null,
  name                 text not null,
  qty                  int not null check (qty > 0),
  price_mode           ops.price_mode not null,
  unit_price           numeric(10, 2),
  estimated_unit_price numeric(10, 2),
  weight_kg            numeric(5, 2),
  modifiers            jsonb not null default '[]', -- ModifierSelection[]
  notes                text not null default '',
  needs_availability   boolean not null default false,
  -- False for frozen "As is" packs: they skip the kitchen queue.
  requires_cooking     boolean not null default true,
  prep_minutes         int,
  item_status          ops.item_status not null default 'pending',
  sort_order           int not null default 0
);

create index order_items_order_idx on ops.order_items (order_id);

create table ops.order_item_availability (
  order_item_id    uuid primary key references ops.order_items (id) on delete cascade,
  status           ops.item_availability not null default 'pending',
  final_unit_price numeric(10, 2),
  substitute_sku   text,
  note             text,
  confirmed_by     uuid references auth.users (id),
  confirmed_at     timestamptz
);

create table ops.payment_verifications (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references ops.orders (id) on delete cascade,
  decision        ops.payment_decision not null,
  reference_no    text,
  sender_name     text,
  amount_received numeric(10, 2),
  reason          text,
  verified_by     uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  check (decision <> 'rejected' or reason is not null)
);

create index payment_verifications_ref_idx on ops.payment_verifications (reference_no);

create table ops.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references ops.orders (id) on delete cascade,
  from_status ops.order_status,
  to_status   ops.order_status not null,
  actor       uuid references auth.users (id),
  note        text,
  created_at  timestamptz not null default now()
);

create index order_events_order_idx on ops.order_events (order_id, created_at);

-- Daily queue codes (A-001, A-002, …) reset each Manila calendar day.
create table ops.queue_counters (
  queue_date  date primary key,
  last_number int not null default 0
);

create or replace function ops.next_queue_code(p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into ops.queue_counters as q (queue_date, last_number)
  values (p_date, 1)
  on conflict (queue_date) do update set last_number = q.last_number + 1
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
  if new.queue_date is null then
    new.queue_date := (new.scheduled_for at time zone 'Asia/Manila')::date;
  end if;
  if new.queue_code is null then
    new.queue_code := ops.next_queue_code(new.queue_date);
  end if;
  return new;
end;
$$;

create trigger orders_assign_queue_code before insert on ops.orders
  for each row execute function ops.assign_queue_code();

-- Every status change lands in the audit log automatically.
create or replace function ops.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into ops.order_events (order_id, from_status, to_status, actor)
    values (new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into ops.order_events (order_id, from_status, to_status, actor)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger orders_log_status after insert or update of status on ops.orders
  for each row execute function ops.log_status_change();

create trigger orders_touch before update on ops.orders
  for each row execute function public.touch_updated_at();

-- ── Availability, stock, menu copy ────────────────────────────────────────────

create table ops.ingredient_daily_status (
  date           date not null,
  ingredient_key text not null,
  status         ops.daily_status not null default 'unknown',
  qty_available  numeric(10, 2),
  market_price   numeric(10, 2),
  updated_by     uuid references auth.users (id),
  updated_at     timestamptz not null default now(),
  primary key (date, ingredient_key)
);

create trigger ingredient_daily_status_touch before update on ops.ingredient_daily_status
  for each row execute function public.touch_updated_at();

create table ops.product_stock (
  sku         text primary key,
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  updated_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now()
);

create trigger product_stock_touch before update on ops.product_stock
  for each row execute function public.touch_updated_at();

create table ops.stock_movements (
  id         bigint generated always as identity primary key,
  sku        text not null,
  delta      int not null,
  reason     ops.stock_reason not null,
  order_id   uuid references ops.orders (id) on delete set null,
  actor      uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table ops.product_overrides (
  sku        text primary key,
  sold_out   boolean not null default false,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create trigger product_overrides_touch before update on ops.product_overrides
  for each row execute function public.touch_updated_at();

-- Read-only copy of the web menu (MenuSnapshot JSON), refreshed on menu.updated.
create table ops.menu_snapshots (
  version     text primary key,
  snapshot    jsonb not null,
  received_at timestamptz not null default now()
);

-- ── Printers and labels ───────────────────────────────────────────────────────

create table ops.printers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  connection      ops.printer_connection not null,
  -- IP for LAN, MAC address for Bluetooth, device name for USB.
  address         text not null,
  port            int default 9100,
  language        ops.printer_language not null,
  label_width_mm  numeric(5, 1) not null default 50,
  label_height_mm numeric(5, 1) not null default 30,
  dpi             int not null default 203 check (dpi in (203, 300)),
  gap_mm          numeric(4, 1) not null default 2,
  options         jsonb not null default '{}', -- copies, auto_print, labels_per_unit, …
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger printers_touch before update on ops.printers
  for each row execute function public.touch_updated_at();

create table ops.label_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       ops.label_kind not null,
  layout     jsonb not null, -- millimetre-based layout rendered by packages/shared printer drivers
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index label_templates_one_default on ops.label_templates (kind) where is_default;

create trigger label_templates_touch before update on ops.label_templates
  for each row execute function public.touch_updated_at();

create table ops.staff_push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Webhooks (ops side) ───────────────────────────────────────────────────────

create table ops.webhook_inbox (
  event_id     text primary key,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);

create table ops.webhook_outbox (
  id              bigint generated always as identity primary key,
  event_id        text not null unique,
  event_type      text not null,
  payload         jsonb not null,
  status          ops.webhook_status not null default 'pending',
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index webhook_outbox_due_idx on ops.webhook_outbox (next_attempt_at) where status = 'pending';

-- ── Row-level security ────────────────────────────────────────────────────────
-- Phase 0 gives every active staff member read/write on day-to-day tables; finer per-role
-- rules (e.g. only verifiers confirm payments) are added with the screens in Phase 4.

do $$
declare t text;
begin
  foreach t in array array[
    'orders', 'order_items', 'order_item_availability', 'payment_verifications', 'order_events',
    'queue_counters', 'ingredient_daily_status', 'product_stock', 'stock_movements', 'product_overrides',
    'menu_snapshots', 'printers', 'label_templates', 'staff_push_tokens', 'webhook_inbox', 'webhook_outbox'
  ] loop
    execute format('alter table ops.%I enable row level security', t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'orders', 'order_items', 'order_item_availability', 'ingredient_daily_status', 'product_stock',
    'product_overrides'
  ] loop
    execute format('create policy "staff read" on ops.%I for select to authenticated using (ops.is_staff())', t);
    execute format('create policy "staff insert" on ops.%I for insert to authenticated with check (ops.is_staff())', t);
    execute format(
      'create policy "staff update" on ops.%I for update to authenticated using (ops.is_staff()) with check (ops.is_staff())',
      t
    );
  end loop;
end;
$$;

create policy "staff read" on ops.order_events for select to authenticated using (ops.is_staff());
create policy "staff read" on ops.stock_movements for select to authenticated using (ops.is_staff());
create policy "staff insert" on ops.stock_movements for insert to authenticated with check (ops.is_staff());
create policy "staff read" on ops.menu_snapshots for select to authenticated using (ops.is_staff());

create policy "verifiers read" on ops.payment_verifications
  for select to authenticated
  using (ops.is_staff());
create policy "verifiers decide" on ops.payment_verifications
  for insert to authenticated
  with check (ops.has_role('owner', 'verifier') and verified_by = (select auth.uid()));

create policy "staff read" on ops.printers for select to authenticated using (ops.is_staff());
create policy "owner manages" on ops.printers
  for all to authenticated using (ops.has_role('owner')) with check (ops.has_role('owner'));
create policy "staff read" on ops.label_templates for select to authenticated using (ops.is_staff());
create policy "owner manages" on ops.label_templates
  for all to authenticated using (ops.has_role('owner')) with check (ops.has_role('owner'));

create policy "staff manage own push tokens" on ops.staff_push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()) and ops.is_staff())
  with check (user_id = (select auth.uid()) and ops.is_staff());

-- queue_counters, webhook_inbox, webhook_outbox: no policies (functions and service role only).

-- ── Realtime (queue board, Sourcing, Payment Review, daily board) ─────────────

alter publication supabase_realtime add table
  ops.orders, ops.order_items, ops.order_item_availability, ops.ingredient_daily_status,
  ops.product_stock, ops.product_overrides;
