-- Store-neutral wording: things that used to be written into the site for Weekend Food Hub are now per store.
--
-- store.stores.contact            How customers reach the store (Facebook Page link or mobile number). Shown on
--                                 its menu and used by the privacy, terms and data deletion pages.
-- store.delivery_settings.area_name  Where the store delivers, in words ("mainland Daanbantayan"). Shown on the
--                                 menu and in the "outside our delivery area" message.

-- "if not exists": production got these columns by hand before this migration was recorded, so it must be
-- safe to run again.
alter table store.stores add column if not exists contact text check (char_length(contact) <= 200);

alter table store.delivery_settings add column if not exists area_name text check (char_length(area_name) <= 80);

-- Both existing stores were set up on Weekend Food Hub's Daanbantayan barangays and service area.
update store.delivery_settings set area_name = 'mainland Daanbantayan'
 where store_id in (select id from store.stores where slug in ('weekendfoodhub', 'treatsbyyang'));
