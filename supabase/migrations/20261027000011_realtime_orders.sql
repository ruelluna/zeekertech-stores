-- Real-time order updates.
--
-- Customers (often guests, so no row-level access) get a broadcast on a channel named after their
-- order's secret access token whenever the order changes; the page then reloads its data from the
-- server. The payload carries no personal details.
create or replace function store.broadcast_web_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('status', new.status, 'paymentStatus', new.payment_status),
    'changed',
    'order:' || new.access_token::text,
    false
  );
  return new;
end;
$$;

create trigger web_orders_broadcast
  after update of status, payment_status, availability_result, total, delivery_fee, status_note, customer_decision
  on store.web_orders
  for each row execute function store.broadcast_web_order();

-- The web server's worker listens for new outbox rows (secret key, bypasses RLS) and delivers
-- them immediately instead of waiting for its next 30-second round.
alter publication supabase_realtime add table store.webhook_outbox, ops.webhook_outbox;
