-- Foundation: schemas, grants, shared helpers, staff roles.
--
-- `store` = web app data (menu, customers, delivery config, web orders). Source of truth for the menu.
-- `ops`   = fulfillment data used by the Android staff app. Source of truth for order progress.
-- The two sides exchange data only through signed webhooks (packages/shared/src/webhooks).
-- They share one Supabase project, and staff roles in ops.staff_users also gate the web admin.

create schema if not exists store;
create schema if not exists ops;

grant usage on schema store to anon, authenticated, service_role;
grant usage on schema ops to authenticated, service_role;

-- Every table has RLS enabled; these grants only make tables reachable, policies decide access.
alter default privileges in schema store grant all on tables to anon, authenticated, service_role;
alter default privileges in schema store grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema store grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema ops grant all on tables to authenticated, service_role;
alter default privileges in schema ops grant all on sequences to authenticated, service_role;
alter default privileges in schema ops grant execute on functions to authenticated, service_role;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Staff and roles ───────────────────────────────────────────────────────────

create type ops.staff_role as enum ('owner', 'verifier', 'kitchen', 'counter');

create table ops.staff_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         ops.staff_role not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger staff_users_touch before update on ops.staff_users
  for each row execute function public.touch_updated_at();

alter table ops.staff_users enable row level security;

create or replace function ops.current_staff_role()
returns ops.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from ops.staff_users where user_id = (select auth.uid()) and active;
$$;

create or replace function ops.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ops.current_staff_role() is not null;
$$;

create or replace function ops.has_role(variadic roles ops.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ops.current_staff_role() = any (roles), false);
$$;

-- Helpers are needed by store policies too (anon must be able to evaluate them as false).
grant usage on schema ops to anon;
grant execute on function ops.current_staff_role(), ops.is_staff(), ops.has_role(ops.staff_role[]) to anon;

create policy "staff read own row" on ops.staff_users
  for select to authenticated
  using (user_id = (select auth.uid()) or ops.has_role('owner'));

create policy "owner manages staff" on ops.staff_users
  for all to authenticated
  using (ops.has_role('owner'))
  with check (ops.has_role('owner'));
