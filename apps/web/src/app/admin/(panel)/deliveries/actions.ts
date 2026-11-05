"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { flushOutboxes } from "@/lib/webhooks/outbox";

/** The rider marks their delivery done (and the cash collected, for pay-on-delivery orders). */
export async function markDelivered(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Invalid order");
  const { userId, role, storeId } = await requireStaff(["rider", "owner"]);

  const ops = createSupabaseAdminClient().schema("ops");
  const { data: order } = await ops
    .from("orders")
    .select("id, status, rider_id, total, flags, payment_status")
    .eq("id", orderId.data)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!order) return fail("Order not found");
  if (role === "rider" && order.rider_id !== userId) return fail("This isn't your delivery");
  if (order.status !== "out_for_delivery") return fail("This order isn't out for delivery");

  const collecting = order.flags.includes("collect_payment") && order.payment_status !== "confirmed";
  const { error } = await ops
    .from("orders")
    .update({
      status: "delivered",
      completed_at: new Date().toISOString(),
      ...(collecting ? { payment_status: "confirmed" as const, flags: order.flags.filter((f) => f !== "collect_payment") } : {}),
    })
    .eq("id", order.id)
    .eq("status", "out_for_delivery");
  if (error) return fail(error.message);
  if (collecting) {
    await ops.from("payment_verifications").insert({ order_id: order.id, decision: "confirmed", amount_received: order.total, verified_by: userId });
  }

  await flushOutboxes().catch((e) => console.error("[deliveries] flush", e));
  refresh();
  return ok("Delivered. Salamat!");
}
