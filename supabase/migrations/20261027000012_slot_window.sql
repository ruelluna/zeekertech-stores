-- Pickup/delivery times start a while after opening and end a while before closing
-- (default: opening + 1 hour to closing − 1 hour, e.g. 2:00 PM–8:00 PM for 1–9 PM hours).
alter table store.store_settings
  add column slot_start_offset_minutes int not null default 60 check (slot_start_offset_minutes between 0 and 600),
  add column slot_end_offset_minutes int not null default 60 check (slot_end_offset_minutes between 0 and 600);
