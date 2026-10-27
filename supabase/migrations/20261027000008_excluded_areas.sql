-- Areas we never deliver to, checked in addition to the (optional) service-area boundary.
-- OpenStreetMap has no usable Daanbantayan boundary yet, so islands are excluded explicitly.
alter table store.delivery_settings add column excluded_areas_geojson jsonb;

-- Malapascua Island (part of Logon). Generous box: open sea separates it from the mainland,
-- whose nearest point (Maya port, ~11.27 N 124.06 E) is well outside it.
-- Carnaza is ~30 km away, beyond the 25 km maximum distance.
update store.delivery_settings
set excluded_areas_geojson = '{
  "type": "MultiPolygon",
  "coordinates": [
    [[[124.095, 11.300], [124.140, 11.300], [124.140, 11.360], [124.095, 11.360], [124.095, 11.300]]]
  ]
}'::jsonb
where id;
