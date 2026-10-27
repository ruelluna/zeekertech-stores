-- Pass the staff's reason along when an order is cancelled, denied or rejected, so the customer sees it.
create or replace function ops.outbox_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.external_id is not null and new.status is distinct from old.status then
    perform ops.enqueue_web_event('order.status_changed', jsonb_build_object(
      'orderId', new.external_id,
      'status', new.status,
      'scheduledFor', to_jsonb(new.scheduled_for),
      'note', case when new.status in ('cancelled', 'denied', 'rejected') then new.notes end
    ));
  end if;
  return new;
end;
$$;
