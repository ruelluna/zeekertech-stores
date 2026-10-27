-- Ordering flow: storage buckets, staff-side actions as functions, and outbox events back to the web.

-- ── Storage ───────────────────────────────────────────────────────────────────
-- Uploads go through the web server with the secret key, so no storage policies are needed.
insert into storage.buckets (id, name, public)
values ('store-public', 'store-public', true),    -- GCash QR, product photos
       ('payment-proofs', 'payment-proofs', false) -- customers' GCash screenshots
on conflict (id) do nothing;

-- ── Outbox helper ─────────────────────────────────────────────────────────────

create or replace function ops.enqueue_web_event(p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := 'evt_' || replace(gen_random_uuid()::text, '-', '');
begin
  insert into ops.webhook_outbox (event_id, event_type, payload)
  values (
    v_id,
    p_event,
    jsonb_build_object('eventId', v_id, 'event', p_event, 'occurredAt', to_jsonb(now())) || p_payload
  );
end;
$$;

-- Status changes on web orders are mirrored to the website (order page, push notifications).
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
      'note', null
    ));
  end if;
  return new;
end;
$$;

create trigger orders_outbox_status after update of status on ops.orders
  for each row execute function ops.outbox_order_status();

-- Menu badges on the website follow the staff app's daily board, sold-out toggles and stock.
create or replace function ops.outbox_ingredient_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform ops.enqueue_web_event('ingredient.daily_status_changed', jsonb_build_object(
    'date', new.date,
    'ingredientKey', new.ingredient_key,
    'status', new.status,
    'qtyAvailable', new.qty_available,
    'marketPrice', new.market_price
  ));
  return new;
end;
$$;

create trigger ingredient_daily_status_outbox after insert or update on ops.ingredient_daily_status
  for each row execute function ops.outbox_ingredient_status();

create or replace function ops.outbox_product_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform ops.enqueue_web_event('product.sold_out_changed', jsonb_build_object('sku', new.sku, 'soldOut', new.sold_out));
  return new;
end;
$$;

create trigger product_overrides_outbox after insert or update on ops.product_overrides
  for each row execute function ops.outbox_product_override();

create or replace function ops.outbox_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform ops.enqueue_web_event('product.stock_changed', jsonb_build_object('sku', new.sku, 'qtyOnHand', new.qty_on_hand));
  return new;
end;
$$;

create trigger product_stock_outbox after insert or update on ops.product_stock
  for each row execute function ops.outbox_product_stock();

-- ── Staff actions (called by the Android app; also used in tests) ─────────────

-- Finish the Sourcing step once every uncertain item has a result. Moves the order to
-- AWAITING_CUSTOMER (something changed) or PENDING_PAYMENT (all good), or DENIED (nothing left).
create or replace function ops.complete_availability_check(p_order_id uuid, p_decision_minutes int default 30)
returns ops.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order ops.orders;
  v_pending int;
  v_available int;
  v_changed boolean;
  v_status ops.order_status;
  v_items jsonb;
begin
  if not (ops.has_role('owner', 'verifier', 'kitchen', 'counter') or (select auth.role()) = 'service_role') then
    raise exception 'not allowed';
  end if;

  select * into v_order from ops.orders where id = p_order_id for update;
  if v_order.status <> 'awaiting_availability' then
    raise exception 'order % is not awaiting availability', v_order.queue_code;
  end if;

  select count(*) filter (where a.status = 'pending'),
         count(*) filter (where coalesce(a.status, 'ready_to_cook') = 'ready_to_cook'),
         bool_or(a.status = 'cant_source' or (i.price_mode = 'market' and a.final_unit_price is distinct from i.estimated_unit_price))
    into v_pending, v_available, v_changed
  from ops.order_items i
  left join ops.order_item_availability a on a.order_item_id = i.id
  where i.order_id = p_order_id;

  if v_pending > 0 then
    raise exception '% item(s) still need a result', v_pending;
  end if;

  -- Market items get their confirmed price.
  update ops.order_items i
     set unit_price = a.final_unit_price
    from ops.order_item_availability a
   where a.order_item_id = i.id and i.order_id = p_order_id and a.final_unit_price is not null;

  if v_available = 0 then
    v_status := 'denied';
  elsif coalesce(v_changed, false) then
    v_status := 'awaiting_customer';
  else
    v_status := 'pending_payment';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'lineId', a.order_item_id,
           'status', a.status,
           'finalUnitPrice', a.final_unit_price,
           'substituteSku', a.substitute_sku,
           'note', a.note)), '[]'::jsonb)
    into v_items
  from ops.order_item_availability a
  join ops.order_items i on i.id = a.order_item_id
  where i.order_id = p_order_id;

  -- Send the result before the status change so the website has the details first.
  if v_order.external_id is not null then
    perform ops.enqueue_web_event('order.availability_result', jsonb_build_object(
      'orderId', v_order.external_id,
      'items', v_items,
      'requiresCustomerDecision', v_status = 'awaiting_customer'
    ));
  end if;

  update ops.orders
     set status = v_status,
         payment_status = case when v_status = 'pending_payment' then 'awaiting_payment' else payment_status end,
         decision_deadline = case when v_status = 'awaiting_customer' then now() + make_interval(mins => p_decision_minutes) end
   where id = p_order_id;

  return v_status;
end;
$$;

-- Record the person's payment decision (Payment Review).
create or replace function ops.review_payment(
  p_order_id uuid,
  p_decision ops.payment_decision,
  p_amount_received numeric default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order ops.orders;
  v_actor uuid := (select auth.uid());
begin
  if not ops.has_role('owner', 'verifier') and (select auth.role()) <> 'service_role' then
    raise exception 'only the owner or a verifier can review payments';
  end if;

  select * into v_order from ops.orders where id = p_order_id for update;
  if v_order.status <> 'pending_payment' then
    raise exception 'order % is not waiting for payment', v_order.queue_code;
  end if;

  insert into ops.payment_verifications (order_id, decision, reference_no, sender_name, amount_received, reason, verified_by)
  values (p_order_id, p_decision, v_order.payment_reference_no, v_order.payment_sender_name, p_amount_received, p_reason,
          coalesce(v_actor, (select user_id from ops.staff_users where role = 'owner' order by created_at limit 1)));

  if v_order.external_id is not null then
    if p_decision = 'confirmed' then
      perform ops.enqueue_web_event('order.payment_confirmed', jsonb_build_object(
        'orderId', v_order.external_id, 'amountReceived', p_amount_received, 'referenceNo', v_order.payment_reference_no));
    elsif p_decision = 'rejected' then
      perform ops.enqueue_web_event('order.payment_rejected', jsonb_build_object(
        'orderId', v_order.external_id, 'reason', p_reason));
    end if;
  end if;

  update ops.orders
     set payment_status = case p_decision when 'confirmed' then 'confirmed' when 'partial' then 'partial' else 'rejected' end::ops.payment_status,
         status = case p_decision when 'confirmed' then 'queued' when 'rejected' then 'rejected' else status end::ops.order_status,
         notes = case when p_decision = 'partial' then concat_ws(E'\n', notes, 'Partial payment: ' || coalesce(p_reason, '')) else notes end
   where id = p_order_id;
end;
$$;

-- Timers run by the web server's worker every minute.
create or replace function ops.run_timers(p_unpaid_flag_minutes int default 30)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update ops.orders
     set status = 'expired', customer_decision = 'expired'
   where status = 'awaiting_customer' and decision_deadline < now();

  update ops.orders
     set flags = array_append(flags, 'unpaid_overdue')
   where status = 'pending_payment'
     and payment_status in ('awaiting_payment', 'not_requested')
     and not ('unpaid_overdue' = any (flags))
     and updated_at < now() - make_interval(mins => p_unpaid_flag_minutes);
end;
$$;

revoke execute on function ops.run_timers(int) from anon, authenticated;
revoke execute on function ops.enqueue_web_event(text, jsonb) from anon, authenticated;
