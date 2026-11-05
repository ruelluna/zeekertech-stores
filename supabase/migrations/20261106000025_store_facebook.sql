-- Each store's own Facebook Page, linked from checkout and the order page ("like our page"). A plain link:
-- Facebook's external Like button was retired in February 2026, and a link loads nothing from Facebook.
--
-- store.stores.facebook_url  Full https:// link to the store's Facebook Page, or null to hide the prompt.

alter table store.stores add column if not exists facebook_url text
  check (facebook_url ~ '^https://([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)/' and char_length(facebook_url) <= 200);

-- A store whose contact is already its Facebook Page starts with that link.
update store.stores
   set facebook_url = case when contact ~* '^https?://' then regexp_replace(contact, '^http://', 'https://', 'i') else 'https://' || contact end
 where facebook_url is null
   and contact ~* '^(https?://)?(www\.|m\.)?(facebook\.com|fb\.com|fb\.me)/[^\s]+$';
