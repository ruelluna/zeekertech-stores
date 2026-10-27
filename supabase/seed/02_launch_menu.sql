-- Launch menu (PLAN.md §7.1). Prices and paid add-ons are left null until the owner sets them;
-- items and options without a price aren't orderable.

insert into store.categories (name, sort_order) values
  ('Chaofan', 1),
  ('Silog', 2),
  ('Paluto', 3),
  ('Frozen', 4);

insert into store.ingredients (key, name, unit, availability_mode, default_wait_minutes) values
  ('siomai', 'Siomai', null, 'always', null),
  ('pork', 'Pork', null, 'always', null),
  ('beef', 'Beef', null, 'always', null),
  ('pork_sisig', 'Pork sisig', null, 'always', null),
  ('beef_tapa', 'Beef tapa', null, 'always', null),
  ('longganisa', 'Longganisa', null, 'always', null),
  ('shrimp', 'Shrimp', 'kg', 'subject_to_availability', 15),
  ('mixed_seafood', 'Mixed seafood', 'kg', 'subject_to_availability', 20),
  ('crab', 'Crab', 'kg', 'subject_to_availability', 20);

insert into store.products (sku, name, category_id, type, price_mode, sold_by, weight_options_kg, prep_minutes, stock_tracked, sort_order)
select p.sku, p.name, c.id, p.type::store.product_type, p.price_mode::store.price_mode, p.sold_by::store.sold_by,
       p.weights::numeric[], p.prep, p.stock_tracked, p.sort_order
from (values
  ('CHF-SIOMAI',  'Siomai Chaofan',    'Chaofan', 'made_to_order', 'fixed',  'unit',   '{}',              15, false, 1),
  ('CHF-PORK',    'Pork Chaofan',      'Chaofan', 'made_to_order', 'fixed',  'unit',   '{}',              15, false, 2),
  ('CHF-BEEF',    'Beef Chaofan',      'Chaofan', 'made_to_order', 'fixed',  'unit',   '{}',              15, false, 3),
  ('CHF-SHRIMP',  'Shrimp Chaofan',    'Chaofan', 'made_to_order', 'fixed',  'unit',   '{}',              15, false, 4),
  ('CHF-SEAFOOD', 'Seafood Chaofan',   'Chaofan', 'made_to_order', 'fixed',  'unit',   '{}',              15, false, 5),
  ('SLG-SISIG',   'Sisig Silog',       'Silog',   'made_to_order', 'fixed',  'unit',   '{}',              15, false, 1),
  ('SLG-TAPA',    'Tapsilog',          'Silog',   'made_to_order', 'fixed',  'unit',   '{}',              15, false, 2),
  ('SLG-LONGGA',  'Longgasilog',       'Silog',   'made_to_order', 'fixed',  'unit',   '{}',              15, false, 3),
  ('SLG-SIOMAI',  'Siomai Silog',      'Silog',   'made_to_order', 'fixed',  'unit',   '{}',              15, false, 4),
  ('PLT-CAJUN',   'Seafood Cajun',     'Paluto',  'made_to_order', 'market', 'weight', '{0.5,1,1.5,2}',   40, false, 1),
  ('PLT-BPCRAB',  'Black Pepper Crab', 'Paluto',  'made_to_order', 'market', 'weight', '{0.5,1,1.5,2}',   40, false, 2),
  -- prep_minutes for frozen items applies only when cooked; "As is" packs skip the kitchen.
  ('FRZ-LUMPIA',  'Vegetable Lumpia',  'Frozen',  'frozen',        'fixed',  'unit',   '{}',              15, true,  1),
  ('FRZ-SISIG',   'Sisig',             'Frozen',  'frozen',        'fixed',  'unit',   '{}',              15, true,  2)
) as p(sku, name, category, type, price_mode, sold_by, weights, prep, stock_tracked, sort_order)
join store.categories c on c.name = p.category;

-- Key ingredients. Frozen Sisig is stock-counted on its own and is not linked to pork_sisig,
-- so selling frozen packs never makes Sisig Silog sold out.
insert into store.product_ingredients (product_id, ingredient_id)
select p.id, i.id
from (values
  ('CHF-SIOMAI', 'siomai'),
  ('CHF-PORK', 'pork'),
  ('CHF-BEEF', 'beef'),
  ('CHF-SHRIMP', 'shrimp'),
  ('CHF-SEAFOOD', 'shrimp'),
  ('CHF-SEAFOOD', 'mixed_seafood'),
  ('SLG-SISIG', 'pork_sisig'),
  ('SLG-TAPA', 'beef_tapa'),
  ('SLG-LONGGA', 'longganisa'),
  ('SLG-SIOMAI', 'siomai'),
  ('PLT-CAJUN', 'mixed_seafood'),
  ('PLT-CAJUN', 'shrimp'),
  ('PLT-BPCRAB', 'crab')
) as pi(sku, ingredient_key)
join store.products p on p.sku = pi.sku
join store.ingredients i on i.key = pi.ingredient_key;

-- Modifier groups (proposed, PLAN.md §7.1). Each frozen product gets its own Preparation group
-- because the cooking fee differs per product.
do $$
declare
  g_addons uuid; g_egg uuid; g_extras uuid; g_spice uuid; g_paluto uuid; g_lumpia uuid; g_sisig uuid;
begin
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Add-ons', false, 0, 2, 1) returning id into g_addons;          -- chaofan
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Egg style', true, 1, 1, 1) returning id into g_egg;            -- silog
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Extras', false, 0, 2, 2) returning id into g_extras;           -- silog
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Spice level', true, 1, 1, 1) returning id into g_spice;        -- paluto
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Paluto add-ons', false, 0, 1, 2) returning id into g_paluto;   -- paluto
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Preparation', true, 1, 1, 1) returning id into g_lumpia;       -- vegetable lumpia
  insert into store.modifier_groups (name, required, min_select, max_select, sort_order)
    values ('Preparation', true, 1, 1, 1) returning id into g_sisig;        -- frozen sisig

  insert into store.modifiers (group_id, name, price_delta, requires_cooking, sort_order) values
    (g_addons, 'Add egg', null, false, 1),
    (g_addons, 'Chili garlic on the side', 0, false, 2),
    (g_egg, 'Sunny side up', 0, false, 1),
    (g_egg, 'Scrambled', 0, false, 2),
    (g_extras, 'Extra rice', null, false, 1),
    (g_extras, 'Extra egg', null, false, 2),
    (g_spice, 'Mild', 0, false, 1),
    (g_spice, 'Regular', 0, false, 2),
    (g_spice, 'Spicy', 0, false, 3),
    (g_paluto, 'Add plain rice', null, false, 1),
    (g_lumpia, 'As is', 0, false, 1),
    (g_lumpia, 'Fried', null, true, 2),     -- cooking fee TBD
    (g_sisig, 'As is', 0, false, 1),
    (g_sisig, 'Cooked', null, true, 2);     -- cooking fee TBD

  insert into store.product_modifier_groups (product_id, group_id, sort_order)
  select p.id, g_addons, 1 from store.products p where p.sku like 'CHF-%'
  union all
  select p.id, g_egg, 1 from store.products p where p.sku like 'SLG-%'
  union all
  select p.id, g_extras, 2 from store.products p where p.sku like 'SLG-%'
  union all
  select p.id, g_spice, 1 from store.products p where p.sku like 'PLT-%'
  union all
  select p.id, g_paluto, 2 from store.products p where p.sku like 'PLT-%'
  union all
  select p.id, g_lumpia, 1 from store.products p where p.sku = 'FRZ-LUMPIA'
  union all
  select p.id, g_sisig, 1 from store.products p where p.sku = 'FRZ-SISIG';
end;
$$;
