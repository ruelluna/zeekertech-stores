# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyone who orders from the kitchen in Tapilon, mostly through the Facebook Page and this site, on a phone:

- Local families in mainland Daanbantayan ordering a meal for the household, for pickup or delivery.
- Young locals and barkada ordering silog, chaofan and snacks.
- Workers and offices ordering meals to a workplace.
- Tourists passing through, often on the way to Malapascua, or staying in town.

Staff (owner/verifier, kitchen, counter, riders) use the admin in a browser on a phone, tablet or PC. An Android staff app (Expo) stays in the repo for later.

## Product Purpose

Weekend Food Hub is a small food business in Purok Molmol, Tapilon, Daanbantayan, Cebu. The site is its storefront: customers browse the menu, order for pickup or delivery, pay by GCash once staff confirm availability and price, and follow the order's status. Success is a customer getting the food they wanted, at the price they agreed to, without phoning or messaging back and forth.

## Positioning

"Weekend" is a feeling, not a schedule. It's treat-day food: hearty chaofan, silog and made-to-order seafood paluto you'd have on a day off, available every day from 1 to 9 PM. Brand work must not suggest the store is only open on weekends.

What a neighbor can't copy: a home-scale kitchen in Tapilon that cooks seasonal seafood (crab, shrimp) to order at market price, checks that the seafood can actually be bought before taking payment, and delivers across mainland Daanbantayan.

## Operating Context

- Orders come from the website, the Facebook Page (Messenger), phone calls and walk-ins.
- Payment is GCash QR to the owner's account, confirmed by a person. Customers pay only after availability and price are confirmed. Cash is accepted for walk-ins.
- Ordering hours are 1:00–9:00 PM every day; pickup and delivery run 2:00–8:00 PM. Hours are editable per day in the admin.
- Delivery covers 19 mainland barangays. Carnaza and Malapascua are excluded. The fee comes from road distance: ₱30 for the first 2 km, then ₱10/km.
- Each order gets a printed label (configurable printer: thermal label printers, browser printing).
- SMS and push notifications update customers; the store name in texts is "Weekend Food Hub".

## Capabilities and Constraints

- Menu categories: Chaofan, Silog (garlic rice, egg and a viand), Paluto (seasonal seafood cooked to order, priced by weight), and Frozen packs (sold as is, or cooked for a fee).
- Sub-brands sell through the same storefront and checkout. The first is **Sweet Treats by Yang** (cakes and pastries, 2 days' notice).
- Next.js web app on self-hosted Supabase, deployed with Coolify on a Hostinger VPS.
- Facebook Login is optional; guest checkout is allowed.

## Brand Commitments

- Name: **Weekend Food Hub** (written as one phrase; "WEEKEND FOODHUB" appears on current materials).
- **Orange stays the brand color.** On the site it is Weekend Food Hub's store accent.
- **Every store shares one theme.** The site is multi-store (Zeeker Tech runs it for independent stores). Each store gets the kitchen-label look from DESIGN.md ("Storefront theme") and picks its own accent colour and, optionally, a logo; Sweet Treats by Yang uses Cabbage Ruby.
- **The logo must print in one color (black) at small sizes** on thermal order labels.
- **The brand must leave room for sub-brands** such as Sweet Treats by Yang, as a family of marks.
- The current logo reads as AI-generated. It is a loose reference only: keep the name and the orange, and nothing else is binding. Any new identity must look deliberately drawn and specific to this kitchen, not generic or machine-made.

## Evidence on Hand

- Launch menu and product facts: `PLAN.md` §7.1 and `supabase/seed/launch_menu.sql`.
- Location, hours and delivery rules: `PLAN.md` §1 and §6.
- No customer testimonials, ratings, sales figures or press exist in the repo. Do not invent them.
- Logo system (Nov 2026): `apps/web/public/brand/` (lockups, label, icons, one-colour thermal cuts), the web app icons in `apps/web/src/app/`, and the staff app icons in `apps/staff/assets/`. Visual rules live in `DESIGN.md`.

## Product Principles

1. Honest about availability and price. Seafood is "subject to availability" and market-priced, and the product says so before anyone pays.
2. Local first. Tapilon, Daanbantayan and Cebuano/Filipino food names are part of the identity, not something to hide.
3. Treat-day warmth, every day. The brand feels like a day off without promising a weekend-only schedule.
4. Phone-first and data-light. Most customers order on a phone, often on mobile data.
5. One kitchen, several brands. Shared ordering and fulfillment, with room for sub-brands to have their own identity.
