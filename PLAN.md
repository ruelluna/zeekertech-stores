# Weekend Food Hub — Ordering System Plan

_Last updated: 2026-10-27_

An online storefront plus an Android staff app for **Weekend Food Hub**, a food business in Daanbantayan, Cebu. Customers order on the website (or in person); a person confirms ingredient availability and GCash payment; only then does the order reach the kitchen queue, where labels are printed and the order is fulfilled by pickup or delivery.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Web app | Built from scratch in **Next.js**. It **owns the menu**, ingredients, delivery areas, fees, promotions and customer accounts |
| Staff app | **Android only** (phones and tablets), **Expo / React Native**. Receives orders from the web app by **webhook** |
| Backend | **Supabase** (Postgres, Auth, Realtime, Storage), **self-hosted**. One project, separate `store` and `ops` schemas that talk only through webhooks/API |
| Hosting | **₱0 to start:** one Oracle Cloud Always Free VM (Singapore) running **Coolify**, which hosts self-hosted Supabase, the Next.js site and any future apps in Docker, each on its own domain with automatic HTTPS (§17) |
| Payment | **GCash QR** (owner's account). A person manually confirms payment in the app. Cash allowed for walk-in orders |
| Pay timing | Customer pays **only after** availability and price are confirmed, so there are no GCash refunds |
| Customer login | **Facebook Login** (no SMS). Guest checkout still allowed |
| Welcome discount | For customers who log in with Facebook. One per Facebook account, with duplicate flags |
| Fulfillment | **Pickup** or **Delivery** |
| Delivery area | **Mainland Daanbantayan only.** 19 barangays. **Carnaza and Malapascua are excluded** |
| Kitchen | **Tapilon, Purok Molmol** (exact map pin set during setup) |
| Delivery fee | Calculated from road distance at ordering time. **₱30 covers the first 2 km, then ₱10/km**, rounded up to ₱5. Staff can override |
| Ordering hours | **1:00 PM – 9:00 PM, every day** (weekdays and weekends, despite the name). **9:00 PM is the last pickup/delivery time**, so same-day ordering closes early enough to finish by 9. Editable per day in the admin |
| Uncertain ingredients | Crabs, shrimp, etc. are **subject to availability**. Staff mark **Ready to cook** or **Can't source**, then the customer continues or cancels |
| Market pricing | **Yes.** Seasonal items have an estimated price on the menu, and the final price is confirmed before payment |
| Labels | Printer is **configurable** (connection, language, label size) |
| Facebook Page | **Weekend Food Hub**. Used later for Messenger order updates |
| Frozen foods | Sold per pack **as is**, or **cooked for an added cooking fee** (then it goes to the kitchen). Stock is counted |
| Walk-in orders | Entered directly in the Android app. **No web app, no account, no customer details required.** Works even when the internet is down |

---

## 2. Architecture

```
┌──────────────── Next.js web app ────────────────┐          ┌──────── Ordering backend (Supabase "ops") ────────┐
│ • Storefront menu with availability badges      │ webhooks │ • Webhook receiver (signature-checked)            │
│ • Facebook Login, saved addresses, map pin      │ ───────▶ │ • Orders, Sourcing, Payment Review, queue,        │
│ • Checkout: fee, discount, GCash QR, ref no.    │          │   dispatch, audit log                             │
│ • Customer decision page, live order status     │ ◀─────── │ • Read-only copy of the menu                      │
│ • Admin: menu, ingredients, barangays, delivery │ webhooks │ • Outgoing status/availability updates (outbox)   │
│   rates, promotions          ← OWNS THE MENU    │          └────────────────────────┬──────────────────────────┘
└─────────────────────────────────────────────────┘                          realtime │
                                                          ┌───────────────────────────┴──────────────────────────┐
                                                          │ Android staff app (Expo)                             │
                                                          │ • Owner/verifier phone: Payment Review, Sourcing,    │
                                                          │   daily availability board, push alerts              │
                                                          │ • Kitchen tablet: queue board, label printing        │
                                                          │ • Counter: manual orders, menu mode, dispatch        │
                                                          └──────────────────────────────────────────────────────┘
```

### Repo layout (Turborepo, pnpm, TypeScript everywhere)

```
apps/web          Next.js (App Router): storefront, checkout, customer pages, admin
apps/staff        Expo (Android only): staff app, built as an APK with EAS
packages/shared   zod schemas (orders, menu, webhooks), fee calculator, label templates, printer drivers
supabase/         migrations (store + ops schemas), seed data, RLS policies
                  (webhook receivers and the outbox sender run as Next.js API routes; retries and timers use pg_cron)
```

### Libraries and services

| Need | Choice |
|---|---|
| Map and pin picker | Leaflet + OpenStreetMap-based tiles (e.g. MapTiler free tier) |
| Road distance | OpenRouteService (free tier). Fallback: straight-line × 1.3, marked "estimated" |
| Service-area check | turf.js point-in-polygon against the mainland Daanbantayan polygon |
| Customer login | Supabase Auth, Facebook provider |
| Browser push | Web Push (VAPID) |
| Email | Resend (or similar), free tier |
| Staff push | Expo Push |
| Printing (Android) | TCP socket (LAN, port 9100), Bluetooth Classic (SPP), USB serial. Requires an Expo dev build |
| App distribution | APK installed directly on staff devices (no Play Store needed). Tablet runs in Android screen-pinning mode |

---

## 3. Customer experience (web)

### 3.1 Menu
- Categories, photos, prices, modifiers (size, add-ons, spice level, notes).
- **Availability badges:**
  - 🟢 *Available today*
  - 🟡 *Subject to availability · we'll confirm in ~20 min · pay only after confirmation*
  - ⚫ *Sold out today*
- **Market-price items** show an estimate, e.g. *"~₱650 · final price confirmed before payment"*.
- Shareable link and printable QR code for the menu.

### 3.2 Login and saved details
- **Continue with Facebook**: name, photo and email (if present) come from Facebook.
- First login asks for a **mobile number** (not verified, needed by riders) and a **delivery address** (barangay, purok/street, landmark, map pin, rider notes).
- Several saved addresses (Home, Work, …), order history, **Reorder**.
- Stays logged in for a long time, so it feels like "remember me".
- Guest checkout: details are remembered on the device, with the nudge *"Log in with Facebook to get ₱50 off."*
- Privacy notice consent, plus a **Delete my account** option.

### 3.3 Checkout
1. Choose **Pickup** (pickup time) or **Delivery** (saved address or new pin).
2. Delivery: the server checks the service area and calculates the fee (§6).
3. The welcome discount applies automatically if eligible.
4. Breakdown: **Subtotal − Discount + Delivery fee = Total**.
5. Two cases:
   - **Everything certain:** shows the GCash QR and exact total. The customer pays, enters the **GCash reference number** and sender name, and can upload a screenshot.
   - **Includes uncertain or market-price items:** order placed **without payment**. The status page shows *Checking availability… (~20 min)*.

### 3.4 Customer decision page (uncertain items)
- **All Ready to cook, price unchanged:** *"Confirmed! Please pay ₱___"*, then the GCash step.
- **Price changed (market price) or some items Can't source:**
  - **Continue** with the updated cart and total
  - **Remove** unavailable items and continue
  - **Swap** for a suggested substitute
  - **Cancel** the order
- No reply within the timeout (default 30 min): the order **expires**.

### 3.5 Order status page
Live updates: Checking availability → Awaiting payment → Payment confirmed → Preparing → Ready / Out for delivery → Picked up / Delivered (or Denied / Cancelled / Expired, with a reason).

### 3.6 Store hours
- Open **every day, 1:00 PM – 9:00 PM** (default for all 7 days). Hours can be changed **per day of the week** in the admin.
- **Closed dates** (holidays, market days off) and a **Pause ordering** switch (also in the Android app) for busy or short-staffed moments.
- **Outside hours or paused:** the menu stays browsable and shows *"We're closed. Ordering opens at 1:00 PM."* Customers can **pre-order** for a time slot when the store is open.
- **Pre-orders:** stay in a *Scheduled* list and enter Sourcing/Payment Review when the store opens. Customer decision and unpaid timers only start counting during open hours.
- **9:00 PM is the last pickup/delivery time, not the last order time.** The same-day cutoff is worked out per order:
  ```
  prep     = longest prep time among the items in the cart (e.g. Silog 15 min, Paluto 40 min; store default 30 min)
  pickup:    last order = 9:00 PM − prep                                → 8:45 PM for silog only
  delivery:  last order = 9:00 PM − prep − travel time − buffer (10 min) → e.g. 8:20 PM for silog with a 15-min drive
  ```
  Travel time comes from the same OpenRouteService route used for the delivery fee.
- **Subject-to-availability dishes** (crabs, shrimp) have an earlier same-day cutoff, **8:00 PM** by default, so there's time to source them. After that they can only be pre-ordered for the next day.
- **Time picker:** offers slots from 1:30 PM (1:00 PM opening + prep time) to 9:00 PM. Slots that can no longer be met disappear as the evening goes on. The checkout re-checks the slot on the server.
- **Staff side:** an order still waiting on sourcing or payment when its slot can no longer be met is flagged on the Android app. Staff can move it to a later slot or the next day, and the customer sees the change on their status page.

### 3.7 Required pages
Privacy policy, data deletion instructions (both required by Meta for Facebook Login and by the Data Privacy Act), terms.

---

## 4. Staff Android app

### 4.1 Roles

| Role | Typical device | Sees |
|---|---|---|
| Owner | Phone | Everything, including settings and reports |
| Verifier | Owner's/wife's phone | Payment Review, Sourcing, daily board, orders |
| Kitchen | Tablet | Queue board, labels, daily board |
| Counter | Tablet or phone | New order, menu mode, dispatch, customers |

### 4.2 Screens

1. **Sourcing:** orders waiting on uncertain ingredients, **grouped by ingredient** (e.g. *"Crabs: 3 orders · ~2.5 kg"*).
   - **Ready to cook (all)** / **Can't source (all)**, or decide per order.
   - Enter the **final market price** and optionally suggest a substitute.
   - Countdown per order. The owner gets an alert if the promised wait time passes.
2. **Daily availability board:** for each uncertain ingredient, set today's status (**Available** / **Out** / **Unknown**), quantity on hand, and **today's market price**. Updates the website instantly. Setting this after the morning market run means most orders skip the waiting step.
3. **Payment Review:**
   - Each card shows the amount due with its breakdown, GCash reference no., sender name and screenshot.
   - Flags: duplicate reference number, possible duplicate welcome discount.
   - Actions: **Confirm ₱X received**, **Partial / wrong amount** (note), **Reject** (reason required).
4. **Queue board (kitchen tablet, landscape):**
   - Columns: Queued → Preparing → Ready, with a timer per card (turns amber, then red).
   - **PICKUP / DELIVERY** badges, new-order sound, tap to move forward, print and reprint labels.
5. **New order:** walk-in, phone and Messenger orders entered by staff (see §4.3).
6. **Menu mode:** full-screen, customer-facing menu with live badges for walk-ins. **Start order** turns the selection into a manual order.
7. **Dispatch:**
   - Ready delivery orders grouped by barangay, with a map pin.
   - Assign a rider by name, then **Out for delivery** → **Delivered**. Ready pickup orders → **Picked up**.
8. **Customers:**
   - Search, order history, Text/Call buttons (opens the phone's SMS app or dialer with a pre-written message).
   - Merge a walk-in record into a Facebook account (by staff only, never automatic).
9. **Sold-out toggle** on any product, sent to the website.
10. **Settings:** printers and label templates, notification sounds, device role.
11. **Today summary:** sales, item counts and prep list, GCash vs cash, discounts used.

### 4.3 Walk-in and phone orders (no web app involved)

Staff create these directly in the Android app, which saves them to the ordering backend. They never touch the website. The customer needs **no account, no Facebook login and no phone number**.

**Walk-in quick sale:**
1. **New order → Walk-in.**
2. Tap products and pick add-ons (e.g. Frozen: *As is* or *Cooked +₱—*).
3. **Customer name is optional**. It's only used on the label. If left blank, the label shows "Walk-in A-043".
4. **Payment:**
   - **Cash:** enter the amount received and the app shows the change. Marked paid.
   - **GCash:** the customer scans the QR at the counter. Staff with verifier permission tap **Confirm** right there after checking the GCash app. Otherwise it goes to Payment Review.
5. **Where each item goes:**
   - Items that need cooking (chaofan, silog, paluto, frozen *Cooked*) go to the kitchen queue and their labels print.
   - Frozen *As is* packs are handed over right away and marked **Handed over**, with no kitchen step.
   - An order with only *As is* frozen packs is **Completed** on the spot.
6. **Subject-to-availability items:** staff already know what's in the kitchen, so they mark Ready to cook (and enter today's market price for paluto) on the order screen. No waiting step and no customer decision page.
7. **Hours:** website ordering hours and cutoffs don't apply. Staff take walk-ins whenever the store is open.

**Phone and Messenger orders** (e.g. messages to the Weekend Food Hub Page):
- Same screen, with source set to *Phone* or *Messenger*.
- Pickup or delivery details: customer search by mobile number, barangay, map pin, automatic fee (editable, with reason).
- Payment: GCash (goes to Payment Review when the customer pays later) or cash on pickup/delivery.

**Works without internet:**
- The Android app keeps the menu, prices, today's availability and stock counts on the device.
- If the internet drops, staff can still take walk-in orders, and labels still print over the shop's Wi-Fi/LAN.
- Orders sync to the backend when the connection returns. Website orders pause until then.

---

## 5. Order lifecycle

```
RECEIVED
  │
  ├─ all items certain ────────────────────────────────────────────────┐
  │                                                                    ▼
  └─▶ AWAITING_AVAILABILITY ──(staff)──▶ AWAITING_CUSTOMER ──(continue)──▶ PENDING_PAYMENT ──(verified)──▶ QUEUED
          │                                  │                                │
          │ nothing can be sourced           ├─ cancel ─▶ CANCELLED           └─ reject ─▶ REJECTED
          ▼                                  └─ timeout ─▶ EXPIRED
       DENIED

QUEUED ─▶ PREPARING ─▶ READY ─┬─ pickup ───────────────────────▶ PICKED_UP
                              └─ delivery ─▶ OUT_FOR_DELIVERY ─▶ DELIVERED

Any open state ─▶ CANCELLED (staff, with reason)
```

- All items confirmed and price unchanged: `AWAITING_CUSTOMER` is skipped. The customer is told to pay.
- Unpaid `PENDING_PAYMENT` orders are flagged after 30 min. Auto-cancel is optional.
- **Walk-in orders** skip `AWAITING_AVAILABILITY` and `AWAITING_CUSTOMER` (staff confirm on the spot). Once paid, they go straight to `QUEUED`, or to `COMPLETED` if they contain only frozen *As is* packs.
- **Frozen *As is* items** in any order are marked `HANDED_OVER` (walk-in) or packed with the rest of the order (pickup/delivery). They never appear on the kitchen queue.
- Every transition is written to `order_events` (who, when, from, to, note).
- If staff change the delivery fee **after** payment, the difference is settled on delivery and recorded.

---

## 6. Delivery

### 6.1 Service area
- **Mainland Daanbantayan only.** Checked in layers:
  - **Boundary polygon** (mainland only), if OpenStreetMap ever has one. As of 2026-10-27 it only has the town's center point, so this layer is empty.
  - **Excluded areas**: a box around Malapascua (`delivery_settings.excluded_areas_geojson`).
  - **Maximum distance** (25 km), which rules out Carnaza (about 30 km away).
  - **No road route** from OpenRouteService, once its key is set.
  - `pnpm import:service-area` loads barangay center points for the checkout map, and the boundary if one appears later.
- Barangays (19): Aguho, Bagay, Bakhawan, Bateria, Bitoon, Calape, Dalingding, Lanao, Logon (mainland only), Malbago, Malingin, Maya, Pajo, Paypay, Poblacion, Talisay, Tapilon, Tinubdan, Tominjao. Each can be paused in the admin.
- **Excluded:** Carnaza (barangay removed) and Malapascua (blocked by the polygon even though it belongs to Logon). Message: *"Sorry, we can't deliver to the islands."*
- No road route found → treated as outside the service area (never given an estimated fee).
- Staff can override for a special case on manual orders, with a reason.

### 6.2 Fee formula

The code lives in `packages/shared`, so the web and Android apps calculate the same fee. The web server recalculates at checkout, so the browser's value is never trusted.

```
fee = base_fee + per_km × max(0, distance_km − included_km)
      → round up to nearest ₱5
      → never below min_fee
      → blocked if distance_km > max_km
      → barangay override (fixed fee or surcharge) wins if set
      → ₱0 if subtotal ≥ free_delivery_threshold (if enabled)
```

| Setting | Default | Status |
|---|---|---|
| Kitchen location | Tapilon, Purok Molmol | ✅ (exact pin set in admin) |
| `base_fee` | ₱30 | ✅ confirmed |
| `included_km` | 2 km | ✅ confirmed |
| `per_km` | ₱10 | ✅ confirmed |
| Rounding | Up to nearest ₱5 | ✅ confirmed |
| `min_fee` | ₱30 | ✅ confirmed |
| `max_km` | 25 km (safety cap, the polygon is the real limit) | ✅ confirmed |
| `free_delivery_threshold` | Off | ✅ confirmed |

Examples with these defaults: 1.2 km → ₱30 · 6.4 km → 30 + 10 × 4.4 = 74 → **₱75** · 12.8 km → 138 → **₱140**.

Each order stores `distance_km`, `distance_method` (`road` | `straight_line`), the full fee breakdown, and who overrode it (if anyone).

---

## 7. Menu, ingredients and market pricing (owned by the web admin)

- **Product types:** `made_to_order` (kitchen), `ready_made` (pack only), `frozen` (see below), `bundle` (splits into its components).
- **Frozen products** have a required **Preparation** option:
  - **As is** (₱0): packed or handed over, no kitchen step.
  - **Cooked** (+ cooking fee set per product): becomes a kitchen item with its own prep time and label.
  - The option carries a `requires_cooking` flag, which decides whether the item goes to the kitchen queue.
- **Stock-counted products** (frozen packs): staff enter the number of packs on the daily board. Every sale, web or walk-in, reduces it, and at 0 the product shows *Sold out* on the website automatically.
- **Ingredients** are linked to products as key ingredients. Availability modes:
  - `always`
  - `subject_to_availability`, with a default wait to confirm (e.g. crabs 20 min, shrimp 15 min)
- **Daily status** (set in the Android app, mirrored to the web): `available` (+ qty, + today's price) / `out` / `unknown`.
  - All key ingredients `available` → normal ordering, no waiting step.
  - Any `out` → *Sold out today*.
  - Any `unknown` → sourcing flow.
- **Price modes:** `fixed`, or `market` with an `estimated_price`. Final price = today's price from the daily board, or the price staff enter when marking Ready to cook. The customer accepts any change before paying.

### 7.1 Launch menu (seeded in Phase 1)

Four categories: 11 cooked products plus frozen packs. Prices stay blank (₱—) until confirmed.

**Chaofan**

| SKU | Product | Key ingredients | Availability | Price |
|---|---|---|---|---|
| CHF-SIOMAI | Siomai Chaofan | Siomai | Always | Fixed ₱— |
| CHF-PORK | Pork Chaofan | Pork | Always | Fixed ₱— |
| CHF-BEEF | Beef Chaofan | Beef | Always | Fixed ₱— |
| CHF-SHRIMP | Shrimp Chaofan | Shrimp | 🟡 Subject to availability | Fixed ₱— |
| CHF-SEAFOOD | Seafood Chaofan | Shrimp, Mixed seafood | 🟡 Subject to availability | Fixed ₱— |

**Silog** (garlic rice + egg + viand)

| SKU | Product | Key ingredients | Availability | Price |
|---|---|---|---|---|
| SLG-SISIG | Sisig Silog | Pork sisig | Always | Fixed ₱— |
| SLG-TAPA | Tapsilog | Beef tapa | Always | Fixed ₱— |
| SLG-LONGGA | Longgasilog | Longganisa | Always | Fixed ₱— |
| SLG-SIOMAI | Siomai Silog | Siomai | Always | Fixed ₱— |

**Paluto** (cooked to order, seasonal seafood)

| SKU | Product | Key ingredients | Availability | Price |
|---|---|---|---|---|
| PLT-CAJUN | Seafood Cajun | Mixed seafood, Shrimp | 🟡 Subject to availability | **Market price, by weight** |
| PLT-BPCRAB | Black Pepper Crab | Crab | 🟡 Subject to availability | **Market price, by weight** |

All 11 above are `made_to_order`.

**Frozen** (sold per pack)

| SKU | Product | Availability | Price |
|---|---|---|---|
| FRZ-LUMPIA | Vegetable Lumpia | **Stock count** | Fixed ₱— per pack · **As is** or **Fried (+₱— cooking fee)** |
| FRZ-SISIG | Sisig | **Stock count** | Fixed ₱— per pack · **As is** or **Cooked (+₱— cooking fee)** |

The cooking fee is **set per product**, and the cooked option's label can be renamed per product (e.g. "Fried" for lumpia).

Frozen Sisig stock is **separate** from the Pork sisig ingredient used in Sisig Silog. Selling frozen packs never makes Sisig Silog sold out.

**Ingredients seeded:**

| Ingredient | Mode | Default wait to confirm | Used in |
|---|---|---|---|
| Siomai | always | — | Siomai Chaofan, Siomai Silog |
| Pork | always | — | Pork Chaofan |
| Beef | always | — | Beef Chaofan |
| Pork sisig | always | — | Sisig Silog |
| Beef tapa | always | — | Tapsilog |
| Longganisa | always | — | Longgasilog |
| Shrimp | subject to availability | 15 min | Shrimp Chaofan, Seafood Chaofan, Seafood Cajun |
| Mixed seafood | subject to availability | 20 min | Seafood Chaofan, Seafood Cajun |
| Crab | subject to availability | 20 min | Black Pepper Crab |

Rice and eggs are treated as always available and not tracked.

**How shared ingredients behave:**
- **Shrimp marked *Out today*** → Shrimp Chaofan, Seafood Chaofan and Seafood Cajun all show *Sold out today*. The chaofans and silogs that don't use shrimp are unaffected.
- **Crab marked *Available* with today's price** → Black Pepper Crab orders normally, without the confirmation wait.
- **Sourcing tab** groups waiting orders by ingredient, so one supplier call about shrimp covers every Shrimp Chaofan, Seafood Chaofan and Seafood Cajun order.

**Paluto pricing (by weight):**
- The customer picks a weight (proposed: 0.5 kg, 1 kg, 1.5 kg, 2 kg).
- **Estimated price** = weight × the latest known price per kg. The menu shows *"~₱___ · final price confirmed before payment."*
- Staff confirm the **final price** (today's price per kg × actual weight) when marking Ready to cook. The customer accepts it, then pays.

**Prep time per product** (sets the same-day cutoff, §3.6): Chaofan and Silog 15 min, Paluto 40 min (proposed).

**Proposed modifiers (to confirm):**

| Category | Modifier groups |
|---|---|
| Chaofan | Add egg (+₱—), Chili garlic on the side (free) |
| Silog | Egg style (Sunny side up / Scrambled), Extra rice (+₱—), Extra egg (+₱—) |
| Paluto | Weight (required), Spice level (Mild / Regular / Spicy), Add plain rice (+₱—) |
| Frozen | Preparation (required): As is / Cooked (+ cooking fee) |

Seed data lives in `supabase/seed/launch_menu.sql`. After launch, the menu is managed in the web admin.

---

## 8. Accounts and discounts

- **Facebook Login** through Supabase Auth.
  - Meta setup: developer app, Facebook Login product, privacy policy URL, data deletion URL, Live mode.
  - Basic name, email and photo access needs no app review.
- **Mobile numbers are not verified.** Walk-in records are matched by number, but merged into a Facebook account **only by staff**, because anyone could type someone else's number.
- **Promotions** (admin):
  - Type: fixed (₱) or percent, with a max discount and minimum order.
  - Trigger: `welcome` (first order after Facebook login), promo `code`, or `auto`.
  - Per-customer limit and validity window (e.g. 30 days after registering).
- **Welcome discount** (placeholder ₱50, min order ₱300): one per Facebook account.
  - Same mobile number or same delivery pin (~30 m) as an account that already used it → flagged in Payment Review, not blocked.
- Every redemption is recorded for reporting.

---

## 9. Payments (GCash, manual)

1. The checkout shows the owner's GCash QR and the exact total, only after availability and price are confirmed.
2. The customer submits the GCash reference number, sender name and an optional screenshot (stored in a private bucket, viewed through signed URLs).
3. The order lands in **Payment Review** and the verifier's phone gets a push notification.
4. The verifier checks the GCash app and taps **Confirm** / **Partial** / **Reject**. This records who did it, when, the amount received and the reference number.
5. A reference number already used on another order triggers a warning.

---

## 10. Notifications

| Who | Channel | Used for |
|---|---|---|
| Customer | Live status page | Everything (always on) |
| Customer | Browser push (Android Chrome) | Availability result, payment confirmed, ready, out for delivery |
| Customer | Email (if Facebook provides one) | Fallback for the above |
| Customer | Staff **Text/Call** buttons (staff's own phone/load) | Anyone who misses a push |
| Customer | Messenger via the **Weekend Food Hub** Page | **Later phase.** "Get updates on Messenger" button, needs Page messaging permission from Meta |
| Staff | Expo push + in-app sound | New order to source, payment to review, order queued, overdue timers |

---

## 11. Label printing

- **Printer settings** (several printers can be saved):
  - Connection: Wi-Fi/LAN (IP:9100), Bluetooth Classic, USB
  - Language: ESC/POS, TSPL, ZPL
  - Label width × height (mm), 203/300 dpi, gap between labels
  - Copies, auto-print when an order is queued, labels per unit or per order
  - **Test print**
- Templates are laid out in millimetres in `packages/shared`. A driver per printer language translates them.
- **Item label (default 50 × 30 mm):**
  ```
  #A-042        DELIVERY 6:00PM
  ANA CRUZ · Brgy. Bagay
  Sisig Silog
  Egg: Sunny side up · + Extra rice
  Oct 28 · 1 of 2
  ```
- **Delivery slip** (optional, per order): order code, name, mobile, barangay, address, landmark, total, fee, payment status.
- Short queue codes (`A-042`) reset daily.

---

## 12. Data model

### 12.1 `store` schema (web app, source of truth for menu and customers)

| Table | Key fields |
|---|---|
| categories | name, sort_order, active |
| products | sku, name, category_id, type, price_mode, price, estimated_price, sold_by (`unit`/`weight`), weight_options_kg, prep_minutes, stock_tracked, image_url, active, label_template |
| modifier_groups / modifiers | name, required, min/max, price_delta, requires_cooking |
| ingredients | name, unit, availability_mode, default_wait_minutes |
| product_ingredients | product_id, ingredient_id, is_key |
| barangays | name, active, center lat/lng, fee_override, surcharge, notes |
| delivery_settings | kitchen lat/lng, base_fee, included_km, per_km, rounding, min_fee, max_km, free_delivery_threshold |
| service_area | mainland polygon (GeoJSON) |
| store_hours | day_of_week, opens_at, closes_at, is_open |
| store_closures | date, reason |
| store_settings | ordering_paused, prep_lead_minutes (30), delivery_buffer_minutes (10), uncertain_items_cutoff (8:00 PM), allow_preorders |
| customers | auth_user_id, facebook_id, name, email, avatar_url, phone, phone_verified, privacy_consent_at, merged_into_customer_id |
| customer_addresses | customer_id, label, barangay_id, street_purok, landmark, lat, lng, rider_notes, is_default |
| promotions | type, value, max_discount, min_order, trigger, code, per_customer_limit, valid_days, starts_at, ends_at, active |
| promotion_redemptions | promotion_id, customer_id, order_id, amount |
| web_orders | customer-facing order record: cart, totals, status, decision, payment submission |
| push_subscriptions | customer_id, endpoint, keys |

### 12.2 `ops` schema (fulfillment, source of truth for order progress)

| Table | Key fields |
|---|---|
| orders | external_id (unique, web orders only), client_id (unique, generated on the device so offline orders sync without duplicates), queue_code, source (`web`/`walk_in`/`phone`/`messenger`), customer snapshot, fulfillment, scheduled_for, address snapshot + lat/lng, barangay, distance_km, distance_method, fee breakdown, fee_overridden_by, subtotal, discount_amount, promotion_id, total, status, payment_status, payment_method, flags, availability_deadline, decision_deadline, customer_decision, rider_name, timestamps |
| order_items | order_id, product_id, a copy of name and price at order time, qty, modifiers (JSON), notes, item_status |
| order_item_availability | order_item_id, status (`pending`/`ready_to_cook`/`cant_source`), final_price, substitute_product_id, confirmed_by, confirmed_at |
| payment_verifications | order_id, verified_by, decision, reference_no, sender_name, amount_received, proof_url, reason |
| order_events | order_id, from_status, to_status, actor, note, created_at |
| ingredient_daily_status | date, ingredient_id, status, qty_available, market_price, updated_by |
| product_stock | product_id, qty_on_hand, updated_by. Adjustments logged in `stock_movements` (sale, restock, correction) |
| menu_snapshots | read-only copy of the web menu (MenuSnapshot JSON), refreshed on `menu.updated` |
| staff_users | auth_user_id, name, role |
| printers / label_templates | connection, language, size, dpi, options / layout JSON |
| webhook_inbox / webhook_outbox | event_id, type, payload, status, attempts, next_attempt_at |

Row-level security everywhere: customers see only their own rows, and staff access depends on role.

---

## 13. Webhook contract

**Signing:**
- Headers: `X-WFH-Event-Id`, `X-WFH-Timestamp`, `X-WFH-Signature: sha256=HMAC(secret, "<timestamp>.<raw body>")` (implemented in `packages/shared/src/webhooks/signing.ts`).
- Rejected if the signature is wrong or the timestamp is older than 5 minutes.
- Receivers ignore repeated `event_id`s and reply `200` quickly, processing after saving.
- Senders write to an outbox first and retry with increasing delays (1 m, 5 m, 30 m, 2 h, 12 h).

| Direction | Event | Purpose |
|---|---|---|
| Web → Ops | `order.created` | New order. `needs_availability: true` routes it to Sourcing, otherwise to Payment Review |
| Web → Ops | `order.payment_submitted` | Customer submitted GCash reference/screenshot |
| Web → Ops | `order.customer_continued` / `order.customer_cancelled` | Decision after the availability result, with the changed cart |
| Web → Ops | `order.cancelled` | Customer cancelled before preparation |
| Web → Ops | `menu.updated`, `delivery_settings.updated` | Refresh the menu copy |
| Ops → Web | `order.availability_result` | Per-item result, final prices, substitutes |
| Ops → Web | `order.payment_confirmed` / `order.payment_rejected` | Result of manual verification |
| Ops → Web | `order.status_changed` | Queued, preparing, ready, out for delivery, delivered, picked up, denied, expired |
| Ops → Web | `order.delivery_fee_changed` | Staff override |
| Ops → Web | `ingredient.daily_status_changed`, `product.sold_out_changed`, `product.stock_changed` | Update the website's badges and frozen stock (walk-in sales included) |

**`order.created` example.** JSON fields are camelCase. The authoritative schemas are in `packages/shared/src/webhooks/events.ts`, and this payload is tested in `webhooks.test.ts`.
```json
{
  "eventId": "evt_01JB...",
  "event": "order.created",
  "occurredAt": "2026-10-31T16:00:00+08:00",
  "order": {
    "orderId": "WEB-10293",
    "customer": { "id": null, "name": "Ana Cruz", "phone": "09171234567", "facebookId": null },
    "fulfillment": "delivery",
    "scheduledFor": "2026-10-31T18:00:00+08:00",
    "address": {
      "barangay": "Bagay", "streetPurok": "Purok 3", "landmark": "Near the chapel",
      "lat": 11.25, "lng": 124.0, "riderNotes": ""
    },
    "delivery": {
      "distanceKm": 6.4, "distanceMethod": "road", "travelMinutes": 15, "fee": 75, "feeSource": "formula",
      "breakdown": { "baseFee": 30, "includedKm": 2, "perKm": 10, "roundTo": 5, "surcharge": 0 }
    },
    "items": [
      {
        "lineId": "6f1c2a8e-3b7d-4c5e-9a1f-2d3e4f5a6b7c",
        "sku": "PLT-BPCRAB", "name": "Black Pepper Crab", "qty": 1,
        "priceMode": "market", "unitPrice": null, "estimatedUnitPrice": 650, "weightKg": 1,
        "modifiers": [{ "group": "Spice level", "option": "Spicy", "priceDelta": 0, "requiresCooking": false }],
        "notes": "", "needsAvailability": true
      }
    ],
    "needsAvailability": true,
    "totals": { "subtotal": 650, "discount": null, "deliveryFee": 75, "total": 725, "isEstimate": true },
    "payment": { "method": "gcash", "status": "not_requested" }
  }
}
```
_(Prices and coordinates above are placeholders.)_

---

## 14. Security and privacy

- Fees, discounts and totals are always recalculated on the server. Browser values are never trusted.
- Supabase row-level security, staff roles, private storage bucket for payment screenshots.
- Webhook secrets and API keys live in environment variables only.
- Data Privacy Act (RA 10173): consent at signup, privacy policy, account and data deletion (also required by Meta).
- Audit trail for every status change, payment decision, fee override and discount removal.

---

## 15. Build phases

| Phase | Scope |
|---|---|
| **0. Setup** ✅ done 2026-10-27 | Monorepo, Supabase project, `store`/`ops` schemas, shared zod schemas, staff auth and roles, CI |
| **1. Web admin + menu** ✅ done 2026-10-27 | Categories, products, modifiers, ingredients, price modes, barangays, delivery settings (kitchen pin as lat/lng), promotions, store hours and closures, owner-only sign-in. Seeded launch menu (§7.1). Public menu with badges and open/closed status. **Moved to Phase 2:** service-area polygon import, map pin picker, GCash QR upload, product photos |
| **2. Web ordering** ✅ done 2026-10-27 (Facebook Login built, waiting on the Meta app) | Service-area import (barangay points + Malapascua exclusion), map pin picker (kitchen + customers), GCash QR and product photo uploads, Facebook Login, mobile number and saved addresses with map pin, fee calculator, service-area check, checkout, welcome discount, GCash step, decision page, order status page, browser push, privacy and data-deletion pages, outbound webhooks |
| **3. Ops backend** ✅ mostly done 2026-10-27 | Webhook receiver (inbox), order tables, outbox sender, timers (decision expiry, unpaid flag). Still to do: menu copy, staff alert when the availability wait passes |
| **3b. Web admin: Orders** ✅ done 2026-10-27 (interim) | Sourcing, Payment Review, kitchen queue, dispatch and cancel in the web admin, using the same database functions the Android app will call |
| **3c. Inventory** ✅ done 2026-10-27 | Daily beginning/received/wasted/ending counts, usage, buy list with alert (§18) |
| **4. Android: confirmations** | Login and roles, Sourcing tab, daily availability board, Payment Review with flags, live queue board with sound, Expo push |
| **5. Android: counter** | Walk-in quick sale (cash with change, on-the-spot GCash confirm, frozen as-is hand-over), phone/Messenger orders with customer search and fee override, **offline walk-in orders with sync**, frozen stock counts, Menu mode, Dispatch, Customers (Text/Call, merge), sold-out toggle |
| **6. Printing** | Printer settings, ESC/POS + TSPL drivers (ZPL if needed), item label + delivery slip, auto-print/reprint |
| **7. Polish** | Coping with weak Wi-Fi (local cache, retry queue), Today summary/reports, timer tuning |
| **8. Later** | Messenger updates via the Weekend Food Hub Page, scheduled/advance orders, inventory, Google login |
| **Deploy** (alongside Phase 2) | Oracle VM + Coolify, self-hosted Supabase, Next.js Docker image, domains and HTTPS, nightly off-site backups (§17). Needed early because Facebook Login only works over HTTPS |

---

## 16. Open items

| Item | Current placeholder |
|---|---|
| Exact kitchen pin (Tapilon, Purok Molmol) | Set in admin during setup |
| Welcome discount amount and minimum order | ₱50 off, ₱300 minimum |
| Default wait to confirm per ingredient | Crabs 20 min, shrimp 15 min |
| Customer decision timeout / unpaid timeout | 30 min / 30 min (flag only) |
| Printer brand and model | Configurable. Build ESC/POS + TSPL first |
| GCash QR image and account name | Uploaded in admin |
| Pickup instructions (exact spot, landmark) | Not yet defined |
| Prices for the 11 launch products and add-ons | ₱— (blank) |
| What goes into Seafood Chaofan and Seafood Cajun | Shrimp + "mixed seafood" (squid, mussels, etc.) |
| Paluto weight options, and whether a cooking fee is added | 0.5 / 1 / 1.5 / 2 kg, no separate cooking fee |
| Modifiers per category (§7.1) | Proposed list, not confirmed |
| Prep time per category | Chaofan/Silog 15 min, Paluto 40 min |
| Frozen pack sizes and prices (Vegetable Lumpia, Sisig) | ₱— (blank) |
| Cooking fee per frozen product | ₱— each (confirmed: different per product) |
| Prep time for cooked frozen items | 15 min (proposed) |
| Domain name | Buying one (e.g. `weekendfoodhub.com`). Exact name and registrar to choose |
| Meta app for Facebook Login | Not created yet. Login is built and hidden until `NEXT_PUBLIC_FACEBOOK_LOGIN=on` |
| OpenRouteService key (road distances) | Not set: straight line × 1.3, orders flagged "estimated" |
| Inventory targets, reorder points, buy-for days | Blank for the 17 starter items |
| Aguho barangay map point | Not found on OpenStreetMap: map centers on the kitchen |

---

## 17. Deployment (₱0 to start)

### 17.1 The server
- **Oracle Cloud Always Free**, home region **Singapore** (closest to Cebu).
  - One Ampere A1 VM: up to **4 ARM cores, 24 GB RAM**, 200 GB disk, Ubuntu. That's plenty for Supabase, the website and several more apps.
  - Signing up needs a card for identity checks only. Always Free resources aren't charged.
- **Coolify** (free, open-source) runs on the VM as a mini Heroku/Vercel:
  - Deploy Docker apps, or straight from GitHub on every push.
  - Give each app its own domain. HTTPS certificates (Let's Encrypt) are issued and renewed automatically.
  - One-click **Supabase** template, scheduled database backups to S3-compatible storage, logs and restarts.

### 17.2 What runs on it

| App | Example domain | How it's deployed |
|---|---|---|
| Website (Next.js) | `weekendfoodhub.com`, `www.weekendfoodhub.com` | Docker image built from `apps/web` (Next.js standalone output), auto-deploy from GitHub |
| Supabase API (Auth, REST, Realtime, Storage) | `api.weekendfoodhub.com` | Coolify Supabase template |
| Supabase Studio (admin dashboard) | `studio.weekendfoodhub.com` | Same template, behind a password |
| Coolify dashboard | `deploy.weekendfoodhub.com` | Installed with Coolify, behind a strong password |
| Your other apps | `anything.weekendfoodhub.com`, or any other domain you own | Any Docker image or GitHub repo |

The staff app isn't hosted. It's an Android APK installed on the devices and pointed at the API domain.

### 17.3 Domain
- **Buy one domain** for the business (e.g. `weekendfoodhub.com`, roughly $10–12/yr).
  - **Cloudflare Registrar** sells domains at cost with no markup, and its DNS is free.
  - Porkbun is a cheap alternative.
  - A `.com` is cheaper and more familiar than `.ph` or `.com.ph`.
- **DNS at Cloudflare (free):**
  - An `A` record for the root domain pointing to the Oracle VM's public IP.
  - A **wildcard** `*` record pointing to the same IP. Every subdomain (`api`, `studio`, `deploy`, future apps) then works without new DNS entries.
  - Records are set to "DNS only" (grey cloud) at first, so Coolify can issue HTTPS certificates directly. Cloudflare's proxy can be turned on later.
- **The same domain is used for:**
  - The Facebook Login redirect URL and app domain
  - The privacy policy and data deletion URLs required by Meta
  - The staff app's API address
- **Other domains you own** can point at the same server too. Add them in Coolify, app by app.

### 17.4 Changes because Supabase is self-hosted
- **Database changes:** `supabase db push --db-url <server database URL>` from a laptop or CI (port only reachable over SSH tunnel). Seed data loads once.
- **Webhook receivers and outbox sender:** Next.js API routes (`/api/webhooks/web`, `/api/webhooks/ops`) instead of Supabase Edge Functions, so there's one thing to deploy.
- **Retries and timers** (outbox, availability/decision/unpaid timers): `pg_cron` jobs inside Postgres, included in the Supabase image.
- **Facebook Login:** the Meta app ID and secret go in the Supabase Auth environment variables in Coolify.

### 17.5 Backups (the one non-negotiable)
- **Nightly database backup** from Coolify to **Cloudflare R2** (free up to 10 GB), kept off the Oracle server.
- **Storage files** (payment screenshots, product photos) synced to R2 nightly.
- **Monthly test restore** to a local Supabase (`pnpm db:start`) to prove backups work.

### 17.6 Security basics
- Only ports 80/443 (web) and 22 (SSH, key-only) open. Postgres is never exposed to the internet.
- Studio and the Coolify dashboard behind strong passwords (optionally Cloudflare Access later).
- Unattended security updates on Ubuntu. Supabase and Coolify images updated monthly.
- Free uptime monitoring (e.g. UptimeRobot) that alerts if the site or API goes down.

### 17.7 Other free services used

| Need | Service | Free allowance (approx., check current limits) |
|---|---|---|
| Code + CI | GitHub private repo + Actions | Free for private repos, with monthly CI minutes |
| Staff app builds | Expo EAS Build free tier, or build the APK locally | Limited cloud builds per month; local builds unlimited |
| Staff push notifications | Expo Push | Free |
| Road distance | OpenRouteService | Free daily quota, far above our volume |
| Map tiles | MapTiler | Free tier |
| Email fallback | Resend | Free monthly quota |
| Customer login | Facebook Login | Free |
| HTTPS | Let's Encrypt (via Coolify) | Free |

### 17.8 Risks of the free setup
- **"Out of capacity" when creating the VM:** Oracle's free ARM machines in popular regions are sometimes full. Retry at different times of day.
- **Idle reclamation:** Oracle may reclaim Always Free VMs that sit nearly idle for a week. Upgrading the account to Pay As You Go stops that, and Always Free resources stay free. Set a ₱1 budget alert so any accidental charge is caught.
- **ARM processor:** Supabase, Next.js and Coolify all publish ARM images. Check this for any extra app added later.
- **One server = one point of failure:** off-site backups make it recoverable. If the business outgrows it, the same Docker setup moves to a paid VPS or Supabase Cloud without code changes.

---

## 18. Inventory (admin)

**Goal:** see each day's beginning and ending stock, and get told what to buy for the next day(s).

- **Items** (owner): name, unit (kg, pcs, pack, liter…), category, and three settings:
  - **Target:** stock to start a day with.
  - **Reorder at:** alert when the ending count drops to this.
  - **Buy for:** how many days one purchase should cover.
  - 17 starter items are seeded (seafood, meats, rice, eggs, oil, frozen packs, packaging).
- **Daily sheet** (any staff, `/admin/inventory?date=…`): beginning, received, wasted and ending per item.
  - Beginning is carried over from the previous day's ending.
  - **Usage = beginning + received − wasted − ending.**
- **Buy list**: buy when one of these is true:
  - the latest count is at or below the reorder point;
  - it won't cover average daily usage (last 7 counted days) × buy-for days;
  - it's below the target.
- **Suggested quantity:** tops up to the larger of the target and the expected usage, rounded up (whole units for pcs/packs, half units for kg/liters).
- **Alerts:** the buy list sits at the top of the Inventory page, and a banner on the Orders page links to it.
- **Later:**
  - A push notification to the owner's phone (with the Android app).
  - Linking frozen-pack counts to the online stock count.
  - Usage estimates from orders (recipes) instead of counts only.
