"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, form, ok, type ActionState } from "@/lib/action-state";
import { requireStaff } from "@/lib/auth";
import { flushOutboxes } from "@/lib/webhooks/outbox";

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
      riderName: form.optText,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request");
  const { from, to, orderId, riderName } = parsed.data;
  if (!(NEXT_STATUS[from] as readonly string[]).includes(to)) return fail("That step isn't allowed");

  const { supabase } = await requireStaff();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .schema("ops")
    .from("orders")
    .update({
      status: to,
      ...(to === "out_for_delivery" ? { rider_name: riderName, out_for_delivery_at: now } : {}),
      ...(to === "picked_up" || to === "delivered" ? { completed_at: now } : {}),
    })
    .eq("id", orderId)
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

  const { supabase } = await requireStaff(["owner", "verifier", "counter"]);
  const { error } = await supabase.schema("ops").from("orders").update({ status: "cancelled", notes: reason }).eq("id", orderId.data);
  if (error) return fail(error.message);
  return done("Order cancelled");
}
