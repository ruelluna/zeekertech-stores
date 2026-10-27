-- An add-on group can depend on another option for a given product, e.g. on chaofan "Egg style"
-- only shows (and is only required) once "Add egg" is picked. Silog shows Egg style always.
alter table store.product_modifier_groups
  add column show_when_modifier_id uuid references store.modifiers (id) on delete set null;
