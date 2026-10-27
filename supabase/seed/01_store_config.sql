-- Store configuration for Weekend Food Hub (PLAN.md §3.6, §6, §8).
-- Values marked TODO are set in the web admin once known.

-- Kitchen: Purok Molmol, Tapilon. TODO: drop the exact pin in the admin (kitchen_lat/kitchen_lng).
-- TODO: import the mainland Daanbantayan boundary (islands removed) into service_area_geojson.
insert into store.delivery_settings (
  id, kitchen_address, base_fee, included_km, per_km, round_to, min_fee, max_km, free_delivery_threshold
) values (
  true, 'Purok Molmol, Tapilon, Daanbantayan, Cebu', 30, 2, 10, 5, 30, 25, null
);

-- Mainland Daanbantayan only. Carnaza is excluded; Malapascua (part of Logon) is blocked by the
-- service-area polygon. Barangay center points are filled in from the map later.
insert into store.barangays (name, notes, sort_order) values
  ('Aguho', null, 1),
  ('Bagay', null, 2),
  ('Bakhawan', null, 3),
  ('Bateria', null, 4),
  ('Bitoon', null, 5),
  ('Calape', null, 6),
  ('Dalingding', null, 7),
  ('Lanao', null, 8),
  ('Logon', 'Mainland only. Malapascua Island is not served.', 9),
  ('Malbago', null, 10),
  ('Malingin', null, 11),
  ('Maya', null, 12),
  ('Pajo', null, 13),
  ('Paypay', null, 14),
  ('Poblacion', null, 15),
  ('Talisay', null, 16),
  ('Tapilon', 'Kitchen location (Purok Molmol).', 17),
  ('Tinubdan', null, 18),
  ('Tominjao', null, 19);

-- 1:00 PM – 9:00 PM every day; 9:00 PM is the last pickup/delivery time.
insert into store.store_hours (day_of_week, opens_at, closes_at, is_open)
select d, '13:00', '21:00', true from generate_series(0, 6) as d;

insert into store.store_settings (
  id, prep_lead_minutes, delivery_buffer_minutes, uncertain_items_cutoff, customer_decision_minutes,
  unpaid_flag_minutes
) values (true, 30, 10, '20:00', 30, 30);

-- Welcome discount placeholder (₱50 off, ₱300 minimum, 30 days). Inactive until confirmed.
insert into store.promotions (name, type, value, min_order, trigger, per_customer_limit, valid_days, active)
values ('Welcome discount', 'fixed', 50, 300, 'welcome', 1, 30, false);
