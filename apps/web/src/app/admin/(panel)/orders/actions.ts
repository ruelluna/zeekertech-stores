"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { riderPay } from "@wfh/shared";
import { fail, form, ok, type ActionState } from "@/lib/action-state";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { flushOutboxes } from "@/lib/webhooks/outbox";
import { isFinished, owesRider } from "./order-status";

// Staff actions on orders. Status changes on web orders reach the customer through the ops outbox
// (database triggers); flushing right away makes the customer's page update within seconds.

async function done(message: string): Promise<ActionState> {
  await flushOutboxes().catch((e) => console.error("[orders] flush", e));
  refresh();
  return ok(message);
}

/** Sourcing: record each uncertain item's result, then finish the check. */
export async function submitAvailability(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Invalid order");
  const { supabase, userId } = await requireStaff();
  const ops = supabase.schema("ops");

  const itemIds = z.array(z.uuid()).safeParse(formData.getAll("itemId"));
  if (!itemIds.success || itemIds.data.length === 0) return fail("No items to check");

  for (const id of itemIds.data) {
    const status = z.enum(["ready_to_cook", "cant_source"]).safeParse(formData.get(`status_${id}`));
    if (!status.success) return fail("Choose Ready to cook or Can't source for every item");
    const price = form.num.pipe(z.number().nonnegative().nullable()).safeParse(formData.get(`price_${id}`));
    const isMarket = formData.get(`market_${id}`) === "1";
    if (!price.success) return fail("Check the prices");
    if (isMarket && status.data === "ready_to_cook" && price.data === null) return fail("Enter the final price for market-price items");

    const { error } = await ops
      .from("order_item_availability")
      .update({
        status: status.data,
        final_unit_price: status.data === "ready_to_cook" ? price.data : null,
        note: String(formData.get(`note_${id}`) ?? "").trim() || null,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("order_item_id", id);
    if (error) return fail(error.message);
  }

  const { data: result, error } = await ops.rpc("complete_availability_check", { p_order_id: orderId.data });
  if (error) return fail(error.message);
  const messages = { awaiting_customer: "Sent to the customer to review", pending_payment: "Confirmed: waiting for payment", denied: "Order denied" } as const;
  return done(messages[result as keyof typeof messages] ?? "Saved");
}

/** Payment Review: confirm, partial or reject. */
export async function reviewPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      orderId: z.uuid(),
      decision: z.enum(["confirmed", "partial", "rejected"]),
      amount: form.num.pipe(z.number().nonnegative().nullable()),
      reason: form.optText,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the payment details");
  if (parsed.data.decision !== "confirmed" && !parsed.data.reason) return fail("Add a reason for the customer");

  const { supabase } = await requireStaff(["owner", "verifier"]);
  const { error } = await supabase.schema("ops").rpc("review_payment", {
    p_order_id: parsed.data.orderId,
    p_decision: parsed.data.decision,
    p_amount_received: parsed.data.amount ?? undefined,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) return fail(error.message);
  return done(parsed.data.decision === "confirmed" ? "Payment confirmed: order is in the queue" : "Saved");
}

const NEXT_STATUS = {
  queued: ["preparing"],
  preparing: ["ready"],
  ready: ["out_for_delivery", "picked_up"],
  out_for_delivery: ["delivered"],
} as const;

/** Kitchen queue and dispatch: move an order to its next status. */
export async function advanceOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      orderId: z.uuid(),
      from: z.enum(["queued", "preparing", "ready", "out_for_delivery"]),
      to: z.enum(["preparing", "ready", "out_for_delivery", "picked_up", "delivered"]),
      /** A rider account (Staff page), or "other" with a typed name. */
      riderId: z.union([z.uuid(), z.literal("other"), z.literal("")]).optional(),
      riderName: form.optText,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request");
  const { from, to, orderId } = parsed.data;
  if (!(NEXT_STATUS[from] as readonly string[]).includes(to)) return fail("That step isn't allowed");

  const { supabase, storeId } = await requireStaff();
  const now = new Date().toISOString();

  // Going out: record the rider and fix their pay for this trip (share of the fee, at least the minimum).
  let dispatch = {};
  if (to === "out_for_delivery") {
    const admin = createSupabaseAdminClient();
    let riderId: string | null = null;
    let riderName = parsed.data.riderName;
    if (parsed.data.riderId && parsed.data.riderId !== "other") {
      const { data: rider } = await admin
        .schema("ops")
        .from("staff_users")
        .select("user_id, display_name")
        .eq("user_id", parsed.data.riderId)
        .eq("store_id", storeId)
        .eq("role", "rider")
        .eq("active", true)
        .maybeSingle();
      if (!rider) return fail("That rider isn't active anymore");
      riderId = rider.user_id;
      riderName = rider.display_name;
    }
    if (!riderName) return fail("Choose the rider");

    const [{ data: order }, { data: settings }] = await Promise.all([
      supabase.schema("ops").from("orders").select("delivery_fee, parent_order_id").eq("id", orderId).eq("store_id", storeId).single(),
      admin.schema("store").from("delivery_settings").select("rider_share_percent, rider_min_pay").eq("store_id", storeId).single(),
    ]);
    const pay = riderPay({
      deliveryFee: order?.delivery_fee ?? 0,
      sharePercent: settings?.rider_share_percent ?? 70,
      minPay: settings?.rider_min_pay ?? 0,
      addOn: Boolean(order?.parent_order_id),
    });
    dispatch = { rider_id: riderId, rider_name: riderName, rider_pay: pay, out_for_delivery_at: now };
  }

  const { data, error } = await supabase
    .schema("ops")
    .from("orders")
    .update({
      status: to,
      ...dispatch,
      ...(to === "picked_up" || to === "delivered" ? { completed_at: now } : {}),
    })
    .eq("id", orderId)
    .eq("store_id", storeId)
    .eq("status", from) // ignore double taps / stale screens
    .select("id");
  if (error) return fail(error.message);
  if (!data.length) return fail("This order was already updated. Refreshing…");
  return done("Updated");
}

export async function staffCancelOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!orderId.success) return fail("Invalid order");
  if (!reason) return fail("Add a reason (the customer sees it)");

  const { supabase, storeId } = await requireStaff(["owner", "verifier", "counter"]);
  const { error } = await supabase
    .schema("ops")
    .from("orders")
    .update({ status: "cancelled", notes: reason })
    .eq("id", orderId.data)
    .eq("store_id", storeId);
  if (error) return fail(error.message);
  return done("Order cancelled");
}

/**
 * Owner only: permanently removes a finished order, on both the staff side and the website, so the customer's
 * order link and "My orders" entry go too. Active orders must be cancelled first, so a customer is never left
 * waiting on an order that vanished. The website side goes first: if a step fails, the order stays on this
 * page and removing it again finishes the job.
 */
export async function removeOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Invalid order");
  const { storeId } = await requireOwner();

  const admin = createSupabaseAdminClient();
  const ops = admin.schema("ops");
  const store = admin.schema("store");

  const { data: order, error: readError } = await ops
    .from("orders")
    .select("status, external_id, payment_proof_path, rider_id, rider_pay, rider_paid_out_at")
    .eq("id", orderId.data)
    .eq("store_id", storeId)
    .maybeSingle();
  if (readError) return fail(readError.message);
  if (!order) return fail("This order was already removed");
  if (!isFinished(order.status)) return fail("Cancel this order first");
  if (owesRider(order)) return fail("Pay the rider for this delivery first (Staff page)");

  const code = order.external_id;
  if (code) {
    // Updates still waiting to be sent would fail and retry against an order that no longer exists.
    const aboutThisOrder = `payload->>orderId.eq.${code},payload->order->>orderId.eq.${code}`;
    const { error: opsOutboxError } = await ops.from("webhook_outbox").delete().eq("status", "pending").or(aboutThisOrder);
    if (opsOutboxError) return fail(opsOutboxError.message);
    const { error: webOutboxError } = await store.from("webhook_outbox").delete().eq("status", "pending").or(aboutThisOrder);
    if (webOutboxError) return fail(webOutboxError.message);

    const { data: webOrder, error: webReadError } = await store.from("web_orders").select("id").eq("order_code", code).eq("store_id", storeId).maybeSingle();
    if (webReadError) return fail(webReadError.message);
    if (webOrder) {
      const { error: redemptionError } = await store.from("promotion_redemptions").delete().eq("web_order_id", webOrder.id);
      if (redemptionError) return fail(redemptionError.message);
      const { error: webDeleteError } = await store.from("web_orders").delete().eq("id", webOrder.id);
      if (webDeleteError) return fail(webDeleteError.message);
    }
  }

  const { error } = await ops.from("orders").delete().eq("id", orderId.data).eq("store_id", storeId);
  if (error) return fail(error.message);

  if (order.payment_proof_path) {
    const { error: proofError } = await admin.storage.from("payment-proofs").remove([order.payment_proof_path]);
    if (proofError) console.error("[orders] remove proof", proofError);
  }
  return done("Order removed");
}

/** For "pay on pickup/delivery" orders: record the cash collected at handover. */
export async function markPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Invalid order");
  const { supabase, userId, storeId } = await requireStaff();
  const ops = supabase.schema("ops");

  const { data: order, error: readError } = await ops
    .from("orders")
    .select("total, flags, payment_status")
    .eq("id", orderId.data)
    .eq("store_id", storeId)
    .single();
  if (readError) return fail(readError.message);
  if (order.payment_status === "confirmed") return fail("Already paid");

  const { error } = await ops
    .from("orders")
    .update({ payment_status: "confirmed", flags: order.flags.filter((f) => f !== "collect_payment") })
    .eq("id", orderId.data);
  if (error) return fail(error.message);
  await createSupabaseAdminClient()
    .schema("ops")
    .from("payment_verifications")
    .insert({ order_id: orderId.data, decision: "confirmed", amount_received: order.total, verified_by: userId });
  return done("Marked as paid");
}
