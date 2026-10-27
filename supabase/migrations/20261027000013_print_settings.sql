-- Browser printing: kitchen tickets (receipt printers) and item labels (label printers).
alter table store.store_settings
  add column print_ticket_width_mm int not null default 80 check (print_ticket_width_mm in (58, 80)),
  add column print_label_width_mm numeric(5, 1) not null default 50 check (print_label_width_mm between 20 and 120),
  add column print_label_height_mm numeric(5, 1) not null default 30 check (print_label_height_mm between 15 and 120),
  -- true: one label per piece (3× Tapsilog → 3 labels); false: one label per order line.
  add column print_labels_per_unit boolean not null default true;
