"use server";

import {
  WebOrder,
  checkSlot,
  manilaParts,
  normalizePhMobile,
  priceCart,
  requiredLeadMinutes,
  storeStatus,
  type DeliveryQuote,
} from "@wfh/shared";
import { fetchCatalog, type CatalogProduct } from "@/lib/catalog";
import { getCurrentCustomer } from "@/lib/customer";
import { quoteDelivery } from "@/lib/delivery";
import { discountAmount, duplicateDiscountFlag, welcomeOfferFor } from "@/lib/discounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueWebEvent, flushOutboxes } from "@/lib/webhooks/outbox";
import { CheckoutInput, type PlaceOrderResult } from "./schema";

const SLOT_ERRORS = {
  closed_that_day: "We're closed on that day. Please pick another date.",
  outside_hours: "That time is outside our pickup and delivery hours. Please pick another time.",
  too_soon: "That time is too soon to prepare your order. Please pick a later time.",
  uncertain_items_cutoff: "Seafood dishes can't be ordered for today anymore. Please pick tomorrow.",
  needs_notice: "Cakes and pastries are made to order. Please pick a later date.",
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Re-checks everything on the server (prices, options, delivery, time, discount), then places the order. */
export async function placeOrder(raw: unknown): Promise<PlaceOrderResult> {
  const parsed = CheckoutInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const input = parsed.data;

  const phone = normalizePhMobile(input.phone);
  if (!phone) return { ok: false, errors: ["Enter a valid mobile number, e.g. 0917 123 4567"] };

  const [catalog, customer] = await Promise.all([fetchCatalog(), getCurrentCustomer()]);
  const now = new Date();

  // Store open / paused / pre-orders
  if (catalog.settings.orderingPaused) return { ok: false, errors: ["Online ordering is paused for a while. Please try again later."] };
  const status = storeStatus({ now, hours: catalog.hours, closures: catalog.closures, paused: false });
  const slot = new Date(input.scheduledFor);

  // Prices and options
  const products = new Map<string, CatalogProduct>(catalog.products.map((p) => [p.id, p]));
  const priced = priceCart(products, input.cart);
  if (!priced.ok) return { ok: false, errors: priced.errors };

  // Items that need advance notice (cakes) are always pre-orders, even when pre-orders are off.
  if (!catalog.settings.allowPreorders && priced.noticeDays === 0) {
    if (status.state !== "open") return { ok: false, errors: ["We're closed right now."] };
    if (manilaParts(slot).dateKey !== manilaParts(now).dateKey) return { ok: false, errors: ["We're only taking orders for today."] };
  }

  // Delivery
  let quote: DeliveryQuote | null = null;
  let barangayName: string | null = null;
  const flags: string[] = [];
  if (input.fulfillment === "delivery") {
    if (!input.address) return { ok: false, errors: ["Add your delivery address"] };
    const result = await quoteDelivery(catalog, {
      lat: input.address.lat,
      lng: input.address.lng,
      barangayId: input.address.barangayId,
      subtotal: priced.subtotal,
    });
    if (!result.ok) return { ok: false, errors: [result.error] };
    quote = result.quote;
    if (result.estimated) flags.push("estimated_distance");
    barangayName = catalog.barangays.find((b) => b.id === input.address!.barangayId)!.name;
  }

  // Time slot
  const lead = requiredLeadMinutes({
    fulfillment: input.fulfillment,
    prepMinutes: priced.prepMinutes || (priced.lines.some((l) => l.requiresCooking) ? catalog.settings.prepLeadMinutes : 0),
    travelMinutes: quote?.travelMinutes ?? null,
    bufferMinutes: catalog.settings.deliveryBufferMinutes,
  });
  const slotCheck = checkSlot({
    now,
    slot,
    leadMinutes: lead,
    hours: catalog.hours,
    closures: catalog.closures,
    hasUncertainItems: priced.needsAvailability,
    uncertainItemsCutoff: catalog.settings.uncertainItemsCutoff,
    slotStartOffsetMinutes: catalog.settings.slotStartOffsetMinutes,
    slotEndOffsetMinutes: catalog.settings.slotEndOffsetMinutes,
    noticeDays: priced.noticeDays,
  });
  if (!slotCheck.ok) return { ok: false, errors: [SLOT_ERRORS[slotCheck.reason]] };

  // Welcome discount (logged-in customers only)
  const offer = await welcomeOfferFor(customer);
  const discount = discountAmount(offer, priced.subtotal);
  if (offer && discount > 0 && customer) {
    const pin = input.address ? { lat: input.address.lat, lng: input.address.lng } : null;
    if (await duplicateDiscountFlag({ promotionId: offer.promotionId, customerId: customer.id, phone, pin })) {
      flags.push("possible_duplicate_discount");
    }
  }

  const deliveryFee = quote?.fee ?? 0;
  const total = round2(Math.max(0, priced.subtotal - discount) + deliveryFee);
  const confirmWaitMinutes = priced.needsAvailability
    ? Math.max(20, ...input.cart.map((l) => products.get(l.productId)?.confirmWaitMinutes ?? 0))
    : null;

  // Save the order
  const store = createSupabaseAdminClient().schema("store");
  const { data: row, error: insertError } = await store
    .from("web_orders")
    .insert({
      customer_id: customer?.id ?? null,
      fulfillment: input.fulfillment,
      scheduled_for: slot.toISOString(),
      status: priced.needsAvailability ? "awaiting_availability" : "pending_payment",
      payment_status: priced.needsAvailability ? "not_requested" : "awaiting_payment",
      subtotal: priced.subtotal,
      discount_amount: discount,
      delivery_fee: deliveryFee,
      total,
      is_estimate: priced.isEstimate,
      order: {},
    })
    .select("id, order_code, access_token")
    .single();
  if (insertError) {
    console.error("[checkout] insert", insertError);
    return { ok: false, errors: ["Something went wrong saving your order. Please try again."] };
  }

  const order = WebOrder.parse({
    orderId: row.order_code,
    customer: { id: customer?.id ?? null, name: input.name, phone, facebookId: null },
    fulfillment: input.fulfillment,
    scheduledFor: slot.toISOString(),
    address:
      input.fulfillment === "delivery" && input.address
        ? {
            barangay: barangayName!,
            streetPurok: input.address.streetPurok,
            landmark: input.address.landmark,
            lat: input.address.lat,
            lng: input.address.lng,
            riderNotes: input.address.riderNotes,
          }
        : null,
    delivery: quote,
    items: priced.lines.map((l) => l.item),
    needsAvailability: priced.needsAvailability,
    confirmWaitMinutes,
    totals: {
      subtotal: priced.subtotal,
      discount: offer && discount > 0 ? { promotionId: offer.promotionId, code: null, amount: discount } : null,
      deliveryFee,
      total,
      isEstimate: priced.isEstimate,
    },
    payment: { method: "gcash", status: priced.needsAvailability ? "not_requested" : "awaiting_payment" },
    flags,
  });

  const { error: updateError } = await store.from("web_orders").update({ order }).eq("id", row.id);
  if (updateError) throw updateError;

  if (customer) {
    if (offer && discount > 0) {
      await store
        .from("promotion_redemptions")
        .insert({ promotion_id: offer.promotionId, customer_id: customer.id, web_order_id: row.id, amount: discount });
    }
    await store.from("customers").update({ phone, name: customer.name || input.name }).eq("id", customer.id);
    if (input.address?.save && input.fulfillment === "delivery") {
      const { count } = await store.from("customer_addresses").select("id", { count: "exact", head: true }).eq("customer_id", customer.id);
      await store.from("customer_addresses").insert({
        customer_id: customer.id,
        label: count ? `Address ${count + 1}` : "Home",
        barangay_id: input.address.barangayId,
        street_purok: input.address.streetPurok,
        landmark: input.address.landmark,
        rider_notes: input.address.riderNotes,
        lat: input.address.lat,
        lng: input.address.lng,
        is_default: !count,
      });
    }
  }

  await enqueueWebEvent({ event: "order.created", order });
  // Deliver right away; the worker retries if the ordering backend is unreachable.
  await flushOutboxes().catch((e) => console.error("[checkout] flush", e));

  return { ok: true, url: `/o/${row.access_token}`, code: row.order_code };
}
