import "server-only";
import type { OrderItem, TablesInsert, WebOrder, WebToOpsEvent } from "@wfh/shared";
import { notifyStaff } from "../push";
import { textAdmin } from "../sms";
import { adminPaymentText, adminSeafoodCheckText } from "../sms-texts";
import { createSupabaseAdminClient } from "../supabase/admin";

// Ordering backend side: turns website events into ops orders the staff app works from.

type Db = ReturnType<typeof createSupabaseAdminClient>;

function itemRow(orderId: string, item: OrderItem, sortOrder: number): TablesInsert<{ schema: "ops" }, "order_items"> {
  return {
    id: item.lineId,
    order_id: orderId,
    sku: item.sku,
    name: item.name,
    qty: item.qty,
    price_mode: item.priceMode,
    unit_price: item.unitPrice,
    estimated_unit_price: item.estimatedUnitPrice,
    weight_kg: item.weightKg,
    modifiers: item.modifiers,
    notes: item.notes,
    needs_availability: item.needsAvailability,
    requires_cooking: item.requiresCooking,
    prep_minutes: item.prepMinutes,
    brand: item.brand,
    sort_order: sortOrder,
  };
}

async function findOrder(db: Db, externalId: string) {
  const { data, error } = await db.schema("ops").from("orders").select("id, status, flags, queue_code").eq("external_id", externalId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Unknown order ${externalId}`);
  return data;
}

async function createOrder(db: Db, order: WebOrder) {
  const ops = db.schema("ops");
  const waitMinutes = order.confirmWaitMinutes ?? 20;
  const { data: created, error } = await ops
    .from("orders")
    .insert({
      external_id: order.orderId,
      source: "web",
      customer_ref: order.customer.id,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      fulfillment: order.fulfillment,
      scheduled_for: order.scheduledFor,
      address: order.address,
      barangay: order.address?.barangay ?? null,
      lat: order.address?.lat ?? null,
      lng: order.address?.lng ?? null,
      distance_km: order.delivery?.distanceKm ?? null,
      distance_method: order.delivery?.distanceMethod ?? null,
      travel_minutes: order.delivery?.travelMinutes ?? null,
      delivery_fee: order.totals.deliveryFee,
      fee_source: order.delivery?.feeSource ?? null,
      fee_breakdown: order.delivery?.breakdown ?? null,
      subtotal: order.totals.subtotal,
      discount_amount: order.totals.discount?.amount ?? 0,
      promotion_ref: order.totals.discount?.promotionId ?? null,
      total: order.totals.total,
      is_estimate: order.totals.isEstimate,
      status: order.needsAvailability ? "awaiting_availability" : "pending_payment",
      payment_method: order.payment.method,
      payment_status: order.needsAvailability ? "not_requested" : "awaiting_payment",
      flags: order.flags,
      availability_deadline: order.needsAvailability ? new Date(Date.now() + waitMinutes * 60_000).toISOString() : null,
    })
    .select("id, queue_code")
    .single();
  if (error) throw error;

  const { error: itemsError } = await ops.from("order_items").insert(order.items.map((item, i) => itemRow(created.id, item, i)));
  if (itemsError) throw itemsError;

  const uncertain = order.items.filter((i) => i.needsAvailability);
  if (uncertain.length) {
    const { error: availError } = await ops
      .from("order_item_availability")
      .insert(uncertain.map((i) => ({ order_item_id: i.lineId, status: "pending" as const })));
    if (availError) throw availError;
  }
  return created;
}

const adminUrl = () => `${process.env.SITE_URL ?? "http://localhost:3100"}/admin/orders`;

// Who gets phone alerts: everyone who can do the seafood check, and only those who can confirm GCash payments.
const SOURCING_ROLES = ["owner", "verifier", "kitchen", "counter"] as const;
const PAYMENT_ROLES = ["owner", "verifier"] as const;

export async function ingestWebEvent(event: WebToOpsEvent): Promise<void> {
  const db = createSupabaseAdminClient();
  const ops = db.schema("ops");

  // Idempotency: each event is processed once, even if the outbox sends it again.
  const { error: inboxError } = await ops
    .from("webhook_inbox")
    .insert({ event_id: event.eventId, event_type: event.event, payload: event });
  if (inboxError?.code === "23505") return;
  if (inboxError) throw inboxError;

  try {
    switch (event.event) {
      case "order.created": {
        const created = await createOrder(db, event.order);
        if (event.order.needsAvailability) {
          const sms = adminSeafoodCheckText({
            code: `${created.queue_code} (${event.order.orderId})`,
            customer: event.order.customer.name,
            fulfillment: event.order.fulfillment,
            total: event.order.totals.total,
            adminUrl: adminUrl(),
          });
          await notifyStaff([...SOURCING_ROLES], {
            title: `🦐 Seafood check: ${created.queue_code}`,
            body: `${event.order.customer.name} · ${event.order.fulfillment} · ₱${event.order.totals.total}. The customer is waiting to pay.`,
            url: adminUrl(),
            tag: `order-${event.order.orderId}`,
          });
          await textAdmin(sms.kind, sms.message, event.order.orderId);
        }
        break;
      }

      case "order.payment_submitted": {
        const order = await findOrder(db, event.orderId);
        const { count } = await ops
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("payment_reference_no", event.referenceNo)
          .neq("id", order.id);
        const flags = count ? [...new Set([...order.flags, "duplicate_reference_no"])] : order.flags;
        const { error } = await ops
          .from("orders")
          .update({
            payment_reference_no: event.referenceNo,
            payment_sender_name: event.senderName,
            payment_amount_claimed: event.amount,
            payment_proof_path: event.proofPath,
            payment_status: "submitted",
            flags,
          })
          .eq("id", order.id);
        if (error) throw error;

        const sms = adminPaymentText({
          code: `${order.queue_code} (${event.orderId})`,
          amount: event.amount,
          referenceNo: event.referenceNo,
          senderName: event.senderName,
          adminUrl: adminUrl(),
        });
        await notifyStaff([...PAYMENT_ROLES], {
          title: `💸 GCash to verify: ${order.queue_code}`,
          body: `₱${event.amount} · ref ${event.referenceNo} · from ${event.senderName}`,
          url: adminUrl(),
          tag: `order-${event.orderId}`,
        });
        await textAdmin(sms.kind, sms.message, event.orderId);
        break;
      }

      case "order.customer_continued": {
        const order = await findOrder(db, event.orderId);
        const keep = new Set(event.items.map((i) => i.lineId));
        const { data: existing, error: itemsError } = await ops.from("order_items").select("id").eq("order_id", order.id);
        if (itemsError) throw itemsError;
        const existingIds = new Set(existing.map((i) => i.id));

        const removed = [...existingIds].filter((id) => !keep.has(id));
        if (removed.length) {
          const { error } = await ops.from("order_items").update({ item_status: "removed" }).in("id", removed);
          if (error) throw error;
        }
        const { error: upsertError } = await ops
          .from("order_items")
          .upsert(event.items.map((item, i) => itemRow(order.id, item, i)));
        if (upsertError) throw upsertError;

        const { error } = await ops
          .from("orders")
          .update({
            subtotal: event.totals.subtotal,
            discount_amount: event.totals.discount?.amount ?? 0,
            delivery_fee: event.totals.deliveryFee,
            total: event.totals.total,
            is_estimate: event.totals.isEstimate,
            customer_decision: "continue",
            status: "pending_payment",
            payment_status: "awaiting_payment",
          })
          .eq("id", order.id);
        if (error) throw error;
        break;
      }

      case "order.customer_cancelled":
      case "order.cancelled": {
        const order = await findOrder(db, event.orderId);
        if (["queued", "preparing", "ready", "out_for_delivery", "delivered", "picked_up", "completed"].includes(order.status)) {
          // Already in the kitchen: staff handle it; keep a note instead of cancelling silently.
          const { error } = await ops
            .from("orders")
            .update({ flags: [...new Set([...order.flags, "customer_asked_to_cancel"])] })
            .eq("id", order.id);
          if (error) throw error;
          break;
        }
        const { error } = await ops
          .from("orders")
          .update({
            status: "cancelled",
            customer_decision: event.event === "order.customer_cancelled" ? "cancel" : null,
            notes: event.reason,
          })
          .eq("id", order.id);
        if (error) throw error;
        break;
      }

      case "menu.updated":
      case "delivery_settings.updated":
        // The staff app reads the menu directly for now; nothing to store.
        break;
    }
    await ops.from("webhook_inbox").update({ processed_at: new Date().toISOString() }).eq("event_id", event.eventId);
  } catch (e) {
    // Let the sender retry: forget the inbox row so the next attempt processes it again.
    await ops.from("webhook_inbox").delete().eq("event_id", event.eventId);
    throw e;
  }
}
