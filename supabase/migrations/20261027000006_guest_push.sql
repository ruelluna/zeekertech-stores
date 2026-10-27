-- Guests (no Facebook login) can also get browser push notifications for the order they placed.
alter table store.push_subscriptions
  alter column customer_id drop not null,
  add column web_order_id uuid references store.web_orders (id) on delete cascade,
  add constraint push_subscriptions_owner check (customer_id is not null or web_order_id is not null);

create index push_subscriptions_order_idx on store.push_subscriptions (web_order_id);
