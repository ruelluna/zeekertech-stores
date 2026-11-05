-- Store theme (DESIGN.md "Storefront theme"): every store shares the kitchen-label look and picks one accent
-- colour, plus an optional logo shown in place of its name in script.
--
-- store.stores.accent_color  Six-digit hex. Buttons, the cart bar, chips and dotted rules use it (never letters).
-- store.stores.logo_url      Public image URL (Storage), or null to show the store name in script.

alter table store.stores add column if not exists accent_color text not null default '#EA580C'
  check (accent_color ~ '^#[0-9A-F]{6}$');

alter table store.stores add column if not exists logo_url text;

update store.stores set accent_color = '#B21E4B' where slug = 'treatsbyyang';
