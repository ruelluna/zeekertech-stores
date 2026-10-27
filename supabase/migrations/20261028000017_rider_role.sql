-- Delivery riders sign in to see their own deliveries. (On its own: a new enum value can't be used in
-- the same transaction that adds it.)
alter type ops.staff_role add value if not exists 'rider';
