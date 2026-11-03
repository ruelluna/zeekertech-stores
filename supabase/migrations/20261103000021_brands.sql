-- Sub-brands sold through the same storefront and checkout, e.g. "Sweet Treats by Yang" (made-to-order
-- cakes and pastries). A category belongs to a brand; categories without one are the main
-- Weekend Food Hub menu. Brands can require advance notice: their items can only be scheduled
-- notice_days calendar days ahead (Manila), unless the product sets its own notice_days.
create table store.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tagline     text,
  notice_days int not null default 0 check (notice_days between 0 and 60),
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger brands_touch before update on store.brands
  for each row execute function public.touch_updated_at();

alter table store.brands enable row level security;
create policy "public read" on store.brands for select to anon, authenticated using (true);
create policy "owner writes" on store.brands
  for all to authenticated using (ops.has_role('owner')) with check (ops.has_role('owner'));

alter table store.categories add column brand_id uuid references store.brands (id) on delete set null;

alter table store.products
  -- Overrides the brand's notice (null = use the brand's).
  add column notice_days int check (notice_days between 0 and 60),
  -- Replaces the "Notes" label when adding to cart, e.g. "Message on the cake".
  add column note_prompt text;

-- Shown on staff order cards and labels so sub-brand items go to the right person.
alter table ops.order_items add column brand text;

with brand as (
  insert into store.brands (name, tagline, notice_days, sort_order)
  values ('Sweet Treats by Yang', 'Made-to-order cakes and pastries', 2, 1)
  on conflict (name) do update set name = excluded.name
  returning id
)
insert into store.categories (name, sort_order, brand_id)
select c.name, c.sort_order, brand.id
from brand, (values ('Cakes', 101), ('Pastries', 102)) as c (name, sort_order)
on conflict (name) do nothing;
