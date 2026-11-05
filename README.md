# Weekend Food Hub — Ordering System

Online storefront + Android staff app for Weekend Food Hub (Daanbantayan, Cebu). The full product plan lives in [PLAN.md](PLAN.md).

## Repo layout

```
apps/web          Next.js storefront, checkout and admin (owns the menu)
apps/staff        Expo app for Android staff devices (Payment Review, Sourcing, queue, labels)
packages/shared   zod schemas, cart pricing, delivery fee, service area, store hours, inventory math, webhook signing
supabase/         migrations (store + ops schemas), seed data, config
scripts/          local test accounts, OpenStreetMap import
```

## Prerequisites

- Node 24+ and pnpm 11 (`packageManager` in package.json)
- Docker Desktop, running, for the local Supabase stack
- Android phone with Expo Go, or an Android emulator, for the staff app

## First-time setup

```bash
pnpm install
cp .env.example .env
pnpm db:start        # starts local Supabase, applies migrations and seed
```

`pnpm db:start` prints the local API URL and keys. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the URL, publishable key and secret key (`pnpm exec supabase status` shows them again).

### Run it

```bash
pnpm dev:owner                          # local test owner (admin), password in apps/web/.env.local
pnpm dev:customer                       # local test customer (stands in for Facebook Login)
pnpm import:service-area                # barangay map points (and the boundary, if OpenStreetMap has one)
pnpm --filter @wfh/web dev --port 3100  # http://localhost:3100
```

- **Customers** (`/`): menu → options → cart → checkout → order page.
  - Checkout: pickup or delivery with a map pin and live fee, a time slot, and the welcome discount when logged in.
  - Order page: GCash payment, continue or cancel after a seafood check, live status, browser notifications.
  - Guests can order without an account.
- **Admin** (`/admin`):
  - **Orders:** Sourcing, Payment Review, kitchen queue, dispatch, cancel, mark paid. Stands in for the Android staff app until it's built. Toasts and a chime announce new orders and payments.
  - **New order:** walk-in, phone or Messenger orders. Payment can be cash now (with change), GCash now, pay on pickup/delivery, or GCash later.
  - **Printing:** kitchen tickets and item labels from any printer the device has, with per-device auto-print (PLAN.md §19).
  - **Staff:** the owner creates logins. Kitchen, Payments and Counter roles only see Orders and Inventory.
  - **Inventory:** daily beginning/ending counts and a buy list.
  - **Menu, add-ons, ingredients, delivery, hours and promotions.**
- **Webhooks:** orders reach the ordering backend at `/api/webhooks/web`, and updates come back to the website at `/api/webhooks/ops`.
- **Real time:** a background worker in the Next.js server listens for new outbox rows (Supabase Realtime) and delivers them within about a second. Every 30 seconds it also retries failures and runs order timers.
  - The customer's order page listens on a broadcast channel named after the order's secret link.
  - The admin Orders page listens to order changes, protected by row-level security.
  - Both reload instantly, with a 60-second fallback.

### Stores and owners

Each store (e.g. `/s/weekendfoodhub`, `/s/treatsbyyang`) has its own menu, settings, customers, orders and staff. Staff access is per store, in `ops.staff_users`; super admins (`ops.super_admins`) manage every store and create stores and their owners at Admin → Stores. To make a real account a super admin, create the user in Supabase Studio (Authentication → Add user), then run this in the SQL editor:

```sql
insert into ops.super_admins (user_id) select id from auth.users where email = 'you@example.com';
```

Roles within a store: `owner`, `verifier`, `kitchen`, `counter`, `rider` (PLAN.md §4.1).

## Deploying

Coolify builds the `Dockerfile` on every push to `main`. When the new container starts, `apps/web/scripts/migrate.mjs` runs before the site:

1. If `DATABASE_URL` is set and there are migrations in `supabase/migrations` the database hasn't run yet, it saves a full backup (every store) to the private Storage bucket `db-backups`, keeping the last 10.
2. It applies each pending migration in its own transaction and records it in `supabase_migrations.schema_migrations`.
3. If the backup or a migration fails, nothing changes and the new version doesn't start; the old one keeps running. The reason is in the container's logs.

Without `DATABASE_URL`, migrations aren't run (apply them by hand in the SQL editor).

To restore a backup: download it from Studio → Storage → `db-backups`, copy it to the server, and run `pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL>" backup.dump`.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the web app and the Expo dev server |
| `pnpm --filter @wfh/web dev --port 3100` | Web app only (http://localhost:3100) |
| `pnpm dev:owner` / `pnpm dev:customer` | Create/reset the local test owner or customer account |
| `pnpm import:service-area` | Import barangay map points (and the boundary, if available) from OpenStreetMap |
| `pnpm --filter @wfh/staff android` | Staff app on a connected Android device/emulator |
| `pnpm test` | Unit tests (pricing, fees, service area, cutoffs, inventory, webhook signing, payload schemas) |
| `pnpm typecheck` / `pnpm lint` | Type and lint checks across the repo |
| `pnpm db:reset` | Rebuilds the local database from migrations + seed |
| `pnpm db:types` | Regenerates `packages/shared/src/database.types.ts` from the local database |

## Database at a glance

- **`store`** (web side): menu, ingredients, modifiers, barangays, delivery settings, store hours, customers, promotions, web orders.
- **`ops`** (staff side): orders, items, availability confirmations, payment verifications, audit log, daily ingredient status, frozen stock, inventory counts, printers, label templates, SMS settings and log, staff push subscriptions.
- Staff actions that must behave the same everywhere live in the database (`ops.complete_availability_check`, `ops.review_payment`), so the web admin and the future Android app share them.
- The two sides exchange data only through signed webhooks (`packages/shared/src/webhooks`).
- Every table has row-level security. Staff permissions come from `ops.staff_users`.

## Still to fill in

- **Before launch, in the admin:** remaining prices, cooking fees, the GCash QR, inventory targets and reorder points.
- **Credentials:** Facebook Login needs the Meta app. Road distances need an OpenRouteService key. Without it, distance is straight line × 1.3 and orders are flagged "estimated". Customer texts go through an Android phone running textbee (`TEXTBEE_API_KEY`; steps in Admin → Texts) or PhilSMS once the business is registered (`SMS_PROVIDER=philsms`). `SMS_DRY_RUN=true` logs texts without sending. Staff alerts are free browser push: tap "Turn on phone alerts" on the Orders page on each phone (needs HTTPS, so the deployed site).
- **Open items:** see PLAN.md §16.
