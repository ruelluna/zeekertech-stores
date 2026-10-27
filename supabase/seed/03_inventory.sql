-- Starter inventory list for the launch menu. Target levels and reorder points are left blank for the
-- owner to fill in (Admin → Inventory → Items).
insert into ops.inventory_items (name, unit, category, sort_order) values
  ('Shrimp', 'kg', 'Seafood', 1),
  ('Crab', 'kg', 'Seafood', 2),
  ('Mixed seafood', 'kg', 'Seafood', 3),
  ('Pork', 'kg', 'Meat', 10),
  ('Beef', 'kg', 'Meat', 11),
  ('Beef tapa', 'kg', 'Meat', 12),
  ('Pork sisig', 'kg', 'Meat', 13),
  ('Longganisa', 'pcs', 'Meat', 14),
  ('Siomai', 'pcs', 'Meat', 15),
  ('Rice', 'kg', 'Dry goods', 20),
  ('Eggs', 'pcs', 'Dry goods', 21),
  ('Garlic', 'kg', 'Dry goods', 22),
  ('Cooking oil', 'liter', 'Dry goods', 23),
  ('Vegetable Lumpia (frozen packs)', 'pack', 'Frozen packs', 30),
  ('Sisig (frozen packs)', 'pack', 'Frozen packs', 31),
  ('Meal boxes', 'pcs', 'Packaging', 40),
  ('Plastic bags', 'pcs', 'Packaging', 41)
on conflict (name) do nothing;
