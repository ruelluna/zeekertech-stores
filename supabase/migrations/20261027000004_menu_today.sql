-- Today's ingredient availability in Manila time, so the storefront doesn't need to know the date.
create view store.ingredient_availability_today
with (security_invoker = true)
as
select ingredient_id, status, qty_available, market_price, updated_at
from store.ingredient_availability
where date = (now() at time zone 'Asia/Manila')::date;
