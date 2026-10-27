-- Daily inventory: beginning/ending counts per item, and what to buy next.

create table ops.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  unit          text not null default 'pcs',      -- pcs, kg, pack, tray, liter, box…
  category      text not null default 'Other',
  -- Stock to have at the start of a day. The buy list tops up to this (or to expected usage).
  par_level     numeric(10, 2) check (par_level >= 0),
  -- Alert when the ending count is at or below this.
  reorder_point numeric(10, 2) check (reorder_point >= 0),
  -- How many days one purchase should cover (e.g. 2 if you shop every other day).
  buy_for_days  int not null default 1 check (buy_for_days between 1 and 14),
  active        boolean not null default true,
  sort_order    int not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger inventory_items_touch before update on ops.inventory_items
  for each row execute function public.touch_updated_at();

create table ops.inventory_counts (
  date       date not null,
  item_id    uuid not null references ops.inventory_items (id) on delete cascade,
  beginning  numeric(10, 2) check (beginning >= 0),
  received   numeric(10, 2) not null default 0 check (received >= 0),
  wasted     numeric(10, 2) not null default 0 check (wasted >= 0),
  ending     numeric(10, 2) check (ending >= 0),
  counted_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (date, item_id)
);

create index inventory_counts_item_idx on ops.inventory_counts (item_id, date desc);

create trigger inventory_counts_touch before update on ops.inventory_counts
  for each row execute function public.touch_updated_at();

alter table ops.inventory_items enable row level security;
alter table ops.inventory_counts enable row level security;

create policy "staff read" on ops.inventory_items for select to authenticated using (ops.is_staff());
create policy "owner manages" on ops.inventory_items
  for all to authenticated using (ops.has_role('owner')) with check (ops.has_role('owner'));

create policy "staff read" on ops.inventory_counts for select to authenticated using (ops.is_staff());
create policy "staff insert" on ops.inventory_counts for insert to authenticated with check (ops.is_staff());
create policy "staff update" on ops.inventory_counts
  for update to authenticated using (ops.is_staff()) with check (ops.is_staff());
