# Weekend Food Hub — Ordering System

Online storefront + Android staff app for Weekend Food Hub (Daanbantayan, Cebu). The full product plan lives in [PLAN.md](PLAN.md).

## Repo layout

```
apps/web          Next.js storefront, checkout and admin (owns the menu)
apps/staff        Expo app for Android staff devices (Payment Review, Sourcing, queue, labels)
packages/shared   zod schemas, webhook signing, delivery fee and store-hours logic (TypeScript source)
supabase/         migrations (store + ops schemas), seed data, config
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

### Admin (web)

```bash
pnpm dev:owner                          # creates the local test owner from apps/web/.env.local
pnpm --filter @wfh/web dev --port 3100  # http://localhost:3100/admin
```

The admin covers menu items and prices, add-ons and cooking fees, ingredients, delivery rates and barangays, hours, closed dates, ordering settings and promotions. Every change updates the public menu at `/` right away.

### Make a real account the owner

Staff access is controlled by `ops.staff_users`. On a real deployment, create the user in Supabase Studio (Authentication → Add user), then run this in the SQL editor:

```sql
insert into ops.staff_users (user_id, display_name, role)
select id, 'Owner', 'owner' from auth.users where email = 'you@example.com';
```

Roles: `owner`, `verifier`, `kitchen`, `counter` (PLAN.md §4.1).

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the web app and the Expo dev server |
| `pnpm --filter @wfh/web dev --port 3100` | Web app only (http://localhost:3100) |
| `pnpm dev:owner` | Create/reset the local test owner account |
| `pnpm --filter @wfh/staff android` | Staff app on a connected Android device/emulator |
| `pnpm test` | Unit tests (fee calculator, cutoffs, webhook signing, payload schemas) |
| `pnpm typecheck` / `pnpm lint` | Type and lint checks across the repo |
| `pnpm db:reset` | Rebuilds the local database from migrations + seed |
| `pnpm db:types` | Regenerates `packages/shared/src/database.types.ts` from the local database |

## Database at a glance

- **`store`** (web side): menu, ingredients, modifiers, barangays, delivery settings, store hours, customers, promotions, web orders.
- **`ops`** (staff side): orders, items, availability confirmations, payment verifications, audit log, daily ingredient status, frozen stock, printers, label templates.
- The two sides exchange data only through signed webhooks (`packages/shared/src/webhooks`).
- Every table has row-level security. Staff permissions come from `ops.staff_users`.

## Still to fill in

Prices, add-on prices, cooking fees, the exact kitchen map pin and the service-area boundary are blank in the seed on purpose. See the open items in PLAN.md §16.
