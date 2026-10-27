-- SMS texts (textbee phone gateway or PhilSMS) for significant order moments only. Owner-only: holds the admin's number.
create table ops.sms_settings (
  id                         boolean primary key default true check (id),
  enabled                    boolean not null default true,
  admin_phone                text check (admin_phone ~ '^09\d{9}$'),
  -- Customer texts (website orders).
  customer_review            boolean not null default true,  -- seafood check done: pay now, or review changes
  customer_payment_rejected  boolean not null default true,
  customer_payment_confirmed boolean not null default false, -- the order page and push already say this
  customer_ready_pickup      boolean not null default true,
  customer_out_for_delivery  boolean not null default true,
  customer_cancelled         boolean not null default true,  -- can't source, no reply in time, or cancelled by staff
  -- Admin texts. Off by default: staff get these as free push alerts on their phones instead.
  admin_seafood_check        boolean not null default false,
  admin_payment_to_verify    boolean not null default false,
  updated_at                 timestamptz not null default now()
);
insert into ops.sms_settings default values;

-- What was texted, for the owner to check delivery and spend. Kept 90 days.
create table ops.sms_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null,
  recipient   text not null,
  message     text not null,
  order_code  text,
  status      text not null check (status in ('sent', 'failed', 'dry_run')),
  provider_id text,
  error       text
);
create index sms_log_created_at on ops.sms_log (created_at desc);

alter table ops.sms_settings enable row level security;
alter table ops.sms_log enable row level security;
create policy "owner manages" on ops.sms_settings
  for all to authenticated using (ops.has_role('owner')) with check (ops.has_role('owner'));
create policy "owner reads" on ops.sms_log for select to authenticated using (ops.has_role('owner'));
