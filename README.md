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

`pnpm db:start` prints the local API URL and keys. Put them in `.env`, then create app env files when the apps start using Supabase (Phase 1+).

### Make yourself the owner

Staff access is controlled by `ops.staff_users`. After signing up a user in Supabase Studio (http://127.0.0.1:54323 → Authentication), run this in the SQL editor:

```sql
insert into ops.staff_users (user_id, display_name, role)
select id, 'Owner', 'owner' from auth.users where email = 'you@example.com';
```

Roles: `owner`, `verifier`, `kitchen`, `counter` (PLAN.md §4.1).

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the web app and the Expo dev server |
| `pnpm --filter @wfh/web dev` | Web app only (http://localhost:3000) |
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
