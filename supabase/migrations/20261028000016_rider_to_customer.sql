-- The customer sees who is delivering their order.
alter table store.web_orders add column rider_name text;

-- Status updates to the website now carry the rider's name (set when the order goes out for delivery).
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
      'note', case when new.status in ('cancelled', 'denied', 'rejected') then new.notes end,
      'riderName', new.rider_name
    ));
  end if;
  return new;
end;
$$;

-- Reload the customer's page when the rider changes too.
drop trigger web_orders_broadcast on store.web_orders;
create trigger web_orders_broadcast
  after update of status, payment_status, availability_result, total, delivery_fee, status_note, customer_decision, rider_name
  on store.web_orders
  for each row execute function store.broadcast_web_order();
