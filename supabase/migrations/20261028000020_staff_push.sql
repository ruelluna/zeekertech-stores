-- Browser push for staff phones: new orders needing a seafood check, payments to verify. Free, unlike SMS.
create table ops.staff_web_push (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index staff_web_push_user on ops.staff_web_push (user_id);

alter table ops.staff_web_push enable row level security;
create policy "staff manage own devices" on ops.staff_web_push
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and ops.is_staff());
