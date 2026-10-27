"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadWebOrderByToken, revisedOrder } from "@/lib/web-order";
import { enqueueWebEvent, flushOutboxes } from "@/lib/webhooks/outbox";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

async function deliver() {
  await flushOutboxes().catch((e) => console.error("[order] flush", e));
}

const PaymentInput = z.object({
  token: z.uuid(),
  referenceNo: z
    .string()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9]{6,20}$/, "Enter the GCash reference number (numbers only, e.g. 1234567890123)")),
  senderName: z.string().trim().min(1, "Enter the GCash account name you paid from").max(80),
});

export async function submitPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = PaymentInput.safeParse({
    token: formData.get("token"),
    referenceNo: formData.get("referenceNo"),
    senderName: formData.get("senderName"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the payment details");

  const loaded = await loadWebOrderByToken(parsed.data.token);
  if (!loaded) return fail("Order not found");
  const { row, order } = loaded;
  if (row.status !== "pending_payment" || !["awaiting_payment", "rejected", "partial"].includes(row.payment_status)) {
    return fail("This order isn't waiting for payment.");
  }

  const db = createSupabaseAdminClient();
  let proofPath: string | null = null;
  const proof = formData.get("proof");
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > MAX_PROOF_BYTES) return fail("The screenshot is too big (max 5 MB).");
    if (!proof.type.startsWith("image/")) return fail("The screenshot must be an image.");
    const ext = proof.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
    proofPath = `${row.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("payment-proofs").upload(proofPath, proof, { contentType: proof.type });
    if (error) return fail("Couldn't upload the screenshot. Try again or send without it.");
  }

  const submission = {
    referenceNo: parsed.data.referenceNo,
    senderName: parsed.data.senderName,
    amount: row.total,
    proofPath,
    submittedAt: new Date().toISOString(),
  };
  const { error } = await db.schema("store").from("web_orders").update({ payment_status: "submitted", payment_submission: submission }).eq("id", row.id);
  if (error) return fail(error.message);

  await enqueueWebEvent({
    event: "order.payment_submitted",
    orderId: order.orderId,
    referenceNo: submission.referenceNo,
    senderName: submission.senderName,
    amount: submission.amount,
    proofPath,
  });
  await deliver();
  refresh();
  return ok("Thanks! We're checking your payment.");
}

export async function decide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = z.uuid().safeParse(formData.get("token"));
  const decision = z.enum(["continue", "cancel"]).safeParse(formData.get("decision"));
  if (!token.success || !decision.success) return fail("Invalid request");

  const loaded = await loadWebOrderByToken(token.data);
  if (!loaded?.availability) return fail("Order not found");
  const { row, order, availability } = loaded;
  if (row.status !== "awaiting_customer") return fail("This order no longer needs a decision.");

  const store = createSupabaseAdminClient().schema("store");
  const revised = await revisedOrder(order, availability);

  if (decision.data === "cancel" || revised.items.length === 0) {
    await store.from("web_orders").update({ status: "cancelled", customer_decision: "cancel" }).eq("id", row.id);
    await enqueueWebEvent({ event: "order.customer_cancelled", orderId: order.orderId, reason: "Customer cancelled after the availability check" });
    await deliver();
    refresh();
    return ok("Your order was cancelled.");
  }

  const { error } = await store
    .from("web_orders")
    .update({
      order: { ...order, items: revised.items, totals: revised.totals },
      subtotal: revised.totals.subtotal,
      discount_amount: revised.totals.discount?.amount ?? 0,
      total: revised.totals.total,
      is_estimate: false,
      customer_decision: "continue",
      status: "pending_payment",
      payment_status: "awaiting_payment",
    })
    .eq("id", row.id);
  if (error) return fail(error.message);

  await enqueueWebEvent({ event: "order.customer_continued", orderId: order.orderId, items: revised.items, totals: revised.totals });
  await deliver();
  refresh();
  return ok("Great! You can pay now.");
}

export async function cancelOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) return fail("Invalid request");
  const loaded = await loadWebOrderByToken(token.data);
  if (!loaded) return fail("Order not found");
  const { row, order } = loaded;

  const cancellable =
    ["awaiting_availability", "awaiting_customer", "pending_payment", "received"].includes(row.status) &&
    !["submitted", "confirmed"].includes(row.payment_status);
  if (!cancellable) return fail("This order can't be cancelled online anymore. Please message us.");

  await createSupabaseAdminClient().schema("store").from("web_orders").update({ status: "cancelled", customer_decision: "cancel" }).eq("id", row.id);
  await enqueueWebEvent({ event: "order.customer_cancelled", orderId: order.orderId, reason: "Cancelled by the customer" });
  await deliver();
  refresh();
  return ok("Your order was cancelled.");
}

const PushInput = z.object({
  token: z.uuid(),
  subscription: z.object({
    endpoint: z.url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const parsed = PushInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const loaded = await loadWebOrderByToken(parsed.data.token);
  if (!loaded) return { ok: false };
  const { endpoint, keys } = parsed.data.subscription;
  const { error } = await createSupabaseAdminClient()
    .schema("store")
    .from("push_subscriptions")
    .upsert(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth, web_order_id: loaded.row.id, customer_id: loaded.row.customer_id },
      { onConflict: "endpoint" },
    );
  return { ok: !error };
}
