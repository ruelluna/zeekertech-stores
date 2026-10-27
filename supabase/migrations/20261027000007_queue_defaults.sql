-- queue_date/queue_code are always set by the trigger; defaults make them optional for inserts.
alter table ops.orders
  alter column queue_date set default ((now() at time zone 'Asia/Manila')::date),
  alter column queue_code set default '';

create or replace function ops.assign_queue_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Codes are per Manila calendar day of the pickup/delivery time.
  new.queue_date := (new.scheduled_for at time zone 'Asia/Manila')::date;
  if coalesce(new.queue_code, '') = '' then
    new.queue_code := ops.next_queue_code(new.queue_date);
  end if;
  return new;
end;
$$;
