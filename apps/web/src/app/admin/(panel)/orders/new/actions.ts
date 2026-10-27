"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { CartLine, Fulfillment, normalizePhMobile, priceLine, type OrderItem, type PricingProduct } from "@wfh/shared";
import { requireStaff } from "@/lib/auth";
import { fetchCatalog } from "@/lib/catalog";
import { quoteDelivery } from "@/lib/delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ManualLine = CartLine.extend({
  /** Required for market-price items (paluto): the price staff agreed with the customer. */
  finalUnitPrice: z.number().nonnegative().nullable(),
});

const ManualOrderInput = z.object({
  source: z.enum(["walk_in", "phone", "messenger"]),
  customerName: z.string().trim().max(80),
  phone: z.string().trim(),
  fulfillment: Fulfillment,
  scheduledFor: z.iso.datetime({ offset: true }),
  address: z
    .object({
      barangayId: z.uuid(),
      streetPurok: z.string().trim().max(120),
      landmark: z.string().trim().max(120),
      riderNotes: z.string().trim().max(200),
      lat: z.number().min(-90).max(90).nullable(),
      lng: z.number().min(-180).max(180).nullable(),
    })
    .nullable(),
  deliveryFee: z.number().nonnegative(),
  feeReason: z.string().trim().max(200),
  payment: z.enum(["cash_now", "gcash_now", "pay_on_handover", "gcash_later"]),
  amountReceived: z.number().nonnegative().nullable(),
  referenceNo: z.string().trim().max(30),
  notes: z.string().trim().max(300),
  lines: z.array(ManualLine).min(1, "Add at least one item").max(40),
});

export type ManualOrderResult = { ok: true; queueCode: string; change: number | null } | { ok: false; errors: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Walk-in, phone and Messenger orders entered by staff (PLAN.md §4.3). Staff confirm seafood on the
 * spot, so there's no Sourcing step; paid orders go straight to the kitchen queue.
 */
export async function createManualOrder(raw: unknown): Promise<ManualOrderResult> {
  const parsed = ManualOrderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const input = parsed.data;
  const { userId } = await requireStaff();

  const errors: string[] = [];
  const phone = input.phone ? normalizePhMobile(input.phone) : null;
  if (input.phone && !phone) errors.push("Enter a valid mobile number, e.g. 0917 123 4567");
  if (!phone && (input.fulfillment === "delivery" || input.source !== "walk_in")) errors.push("Add the customer's mobile number");
  const name = input.customerName || (input.source === "walk_in" ? "Walk-in" : "");
  if (!name) errors.push("Add the customer's name");

  // Price every line against the current menu. Uncertain items count as confirmed (staff can check now).
  const catalog = await fetchCatalog();
  const products = new Map<string, PricingProduct>(
    catalog.products.map((p) => [p.id, { ...p, badge: p.badge === "subject_to_availability" ? "available" : p.badge }]),
  );
  const items: (OrderItem & { requiresCooking: boolean })[] = [];
  for (const line of input.lines) {
    const product = products.get(line.productId);
    if (!product) {
      errors.push("An item is no longer on the menu");
      continue;
    }
    const result = priceLine(product, line);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    const item = result.line.item;
    if (item.priceMode === "market") {
      if (line.finalUnitPrice === null) {
        errors.push(`Enter the final price for ${item.name}`);
        continue;
      }
      item.unitPrice = line.finalUnitPrice;
    }
    items.push({ ...item, needsAvailability: false });
  }

  // Delivery: the fee is what staff entered; a quote fills in the distance and flags overrides.
  let barangay: string | null = null;
  let distance: { km: number; method: "road" | "straight_line"; minutes: number | null } | null = null;
  let feeSource: "formula" | "manual" = "manual";
  if (input.fulfillment === "delivery") {
    if (!input.address) errors.push("Add the delivery address");
    else {
      barangay = catalog.barangays.find((b) => b.id === input.address!.barangayId)?.name ?? null;
      if (!barangay) errors.push("Choose an active barangay");
      if (input.address.lat !== null && input.address.lng !== null && barangay) {
        const quote = await quoteDelivery(catalog, {
          lat: input.address.lat,
          lng: input.address.lng,
          barangayId: input.address.barangayId,
          subtotal: 0,
        });
        if (quote.ok) {
          distance = { km: quote.quote.distanceKm, method: quote.quote.distanceMethod, minutes: quote.quote.travelMinutes };
          if (quote.quote.fee === input.deliveryFee) feeSource = "formula";
        }
      }
      if (feeSource === "manual" && !input.feeReason) errors.push("Add a reason for the delivery fee (it differs from the calculated fee)");
    }
  }
  if (errors.length) return { ok: false, errors };

  const subtotal = round2(items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.qty, 0));
  const deliveryFee = input.fulfillment === "delivery" ? input.deliveryFee : 0;
  const total = round2(subtotal + deliveryFee);

  const paidNow = input.payment === "cash_now" || input.payment === "gcash_now";
  if (input.payment === "cash_now" && (input.amountReceived ?? 0) < total) {
    return { ok: false, errors: [`Cash received is less than the total (₱${total})`] };
  }
  const handedOverNow = paidNow && input.source === "walk_in" && input.fulfillment === "pickup" && items.every((i) => !i.requiresCooking);
  const status = handedOverNow ? "completed" : input.payment === "gcash_later" ? "pending_payment" : "queued";
  const now = new Date().toISOString();

  const ops = createSupabaseAdminClient().schema("ops");
  const { data: order, error } = await ops
    .from("orders")
    .insert({
      source: input.source,
      client_id: crypto.randomUUID(),
      customer_name: name,
      customer_phone: phone,
      fulfillment: input.fulfillment,
      scheduled_for: input.scheduledFor,
      address:
        input.fulfillment === "delivery" && input.address
          ? {
              barangay,
              streetPurok: input.address.streetPurok,
              landmark: input.address.landmark,
              riderNotes: input.address.riderNotes,
              ...(input.address.lat !== null ? { lat: input.address.lat, lng: input.address.lng } : {}),
            }
          : null,
      barangay,
      lat: input.address?.lat ?? null,
      lng: input.address?.lng ?? null,
      distance_km: distance?.km ?? null,
      distance_method: distance?.method ?? null,
      travel_minutes: distance?.minutes ?? null,
      delivery_fee: deliveryFee,
      fee_source: input.fulfillment === "delivery" ? feeSource : null,
      fee_overridden_by: feeSource === "manual" && input.fulfillment === "delivery" ? userId : null,
      fee_override_reason: feeSource === "manual" && input.fulfillment === "delivery" ? input.feeReason : null,
      subtotal,
      total,
      status,
      payment_method: input.payment === "cash_now" || input.payment === "pay_on_handover" ? "cash" : "gcash",
      payment_status: paidNow ? "confirmed" : "awaiting_payment",
      payment_reference_no: input.referenceNo || null,
      flags: input.payment === "pay_on_handover" ? ["collect_payment"] : [],
      notes: input.notes || null,
      created_by: userId,
      completed_at: handedOverNow ? now : null,
    })
    .select("id, queue_code")
    .single();
  if (error) return { ok: false, errors: [error.message] };

  const { error: itemsError } = await ops.from("order_items").insert(
    items.map((i, index) => ({
      id: i.lineId,
      order_id: order.id,
      sku: i.sku,
      name: i.name,
      qty: i.qty,
      price_mode: i.priceMode,
      unit_price: i.unitPrice,
      estimated_unit_price: i.estimatedUnitPrice,
      weight_kg: i.weightKg,
      modifiers: i.modifiers,
      notes: i.notes,
      needs_availability: false,
      requires_cooking: i.requiresCooking,
      prep_minutes: i.prepMinutes,
      item_status: handedOverNow || !i.requiresCooking ? ("handed_over" as const) : ("pending" as const),
      sort_order: index,
    })),
  );
  if (itemsError) {
    await ops.from("orders").delete().eq("id", order.id);
    return { ok: false, errors: [itemsError.message] };
  }

  if (paidNow) {
    await ops.from("payment_verifications").insert({
      order_id: order.id,
      decision: "confirmed",
      reference_no: input.referenceNo || null,
      amount_received: input.payment === "cash_now" ? input.amountReceived : total,
      verified_by: userId,
    });
  }

  refresh();
  return {
    ok: true,
    queueCode: order.queue_code,
    change: input.payment === "cash_now" ? round2((input.amountReceived ?? 0) - total) : null,
  };
}
