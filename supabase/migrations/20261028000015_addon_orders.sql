-- Items a customer adds after ordering (e.g. by phone while the order is being prepared) become a
-- small linked "add-on" order: its own labels and payment, same customer, address and time.
alter table ops.orders add column parent_order_id uuid references ops.orders (id) on delete set null;

create index orders_parent_idx on ops.orders (parent_order_id) where parent_order_id is not null;
