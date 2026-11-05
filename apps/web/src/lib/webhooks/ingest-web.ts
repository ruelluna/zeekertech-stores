import "server-only";
import { revalidateTag } from "next/cache";
import type { OpsToWebEvent, TablesUpdate } from "@wfh/shared";
import { MENU_TAG } from "../menu-tag";
import { STATUS_TEXT } from "../order-status";
import { notifyOrder } from "../push";
import { textCustomer } from "../sms";
import { customerStatusText } from "../sms-texts";
import { getStoreById } from "../stores";
import { createSupabaseAdminClient } from "../supabase/admin";

// Website side: applies ordering-backend updates to web orders and menu badges.

export async function ingestOpsEvent(event: OpsToWebEvent): Promise<void> {
  const store = createSupabaseAdminClient().schema("store");

  const { error: inboxError } = await store
    .from("webhook_inbox")
    .insert({ event_id: event.eventId, event_type: event.event, payload: event });
  if (inboxError?.code === "23505") return;
  if (inboxError) throw inboxError;

  const order = async (code: string) => {
    const { data, error } = await store
      .from("web_orders")
      .select("id, store_id, customer_id, access_token, total, delivery_fee, status, fulfillment, order")
      .eq("order_code", code)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Unknown web order ${code}`);
    return data;
  };
  const update = async (id: string, fields: TablesUpdate<{ schema: "store" }, "web_orders">) => {
    const { error } = await store.from("web_orders").update(fields).eq("id", id);
    if (error) throw error;
  };
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3100";

  try {
    switch (event.event) {
      case "order.availability_result": {
        const o = await order(event.orderId);
        await update(o.id, { availability_result: { items: event.items, requiresCustomerDecision: event.requiresCustomerDecision } });
        break;
      }
      case "order.status_changed": {
        const o = await order(event.orderId);
        await update(o.id, {
          status: event.status,
          ...(event.status === "pending_payment" ? { payment_status: "awaiting_payment" as const } : {}),
          ...(event.note ? { status_note: event.note } : {}),
          ...(event.riderName ? { rider_name: event.riderName } : {}),
        });
        const text = STATUS_TEXT[event.status];
        const body = event.status === "out_for_delivery" && event.riderName ? `${event.riderName} is on the way with your order.` : text.body;
        await notifyOrder(o.id, o.customer_id, { title: text.title, body, url: `${siteUrl}/o/${o.access_token}` });

        const storeName = (await getStoreById(o.store_id))?.name ?? "Your order";
        const sms = customerStatusText(
          event.status,
          o.status,
          { store: storeName, code: event.orderId, total: o.total, fulfillment: o.fulfillment, link: `${siteUrl}/o/${o.access_token}` },
          event.riderName,
        );
        const phone = (o.order as { customer?: { phone?: string } } | null)?.customer?.phone;
        if (sms) await textCustomer(o.store_id, sms.kind, phone, sms.message, event.orderId);
        break;
      }
      case "order.payment_confirmed": {
        const o = await order(event.orderId);
        await update(o.id, { payment_status: "confirmed" });
        break;
      }
      case "order.payment_rejected": {
        const o = await order(event.orderId);
        await update(o.id, { payment_status: "rejected", status_note: event.reason });
        break;
      }
      case "order.delivery_fee_changed": {
        const o = await order(event.orderId);
        await update(o.id, {
          delivery_fee: event.deliveryFee,
          total: Math.round((o.total - o.delivery_fee + event.deliveryFee) * 100) / 100,
          status_note: `Delivery fee updated: ${event.reason}`,
        });
        break;
      }
      case "ingredient.daily_status_changed": {
        const { data: ingredient } = await store.from("ingredients").select("id").eq("key", event.ingredientKey).maybeSingle();
        if (ingredient) {
          const { error } = await store.from("ingredient_availability").upsert({
            ingredient_id: ingredient.id,
            date: event.date,
            status: event.status,
            qty_available: event.qtyAvailable,
            market_price: event.marketPrice,
          });
          if (error) throw error;
        }
        revalidateTag(MENU_TAG, { expire: 0 });
        break;
      }
      case "product.sold_out_changed": {
        const { error } = await store.from("products").update({ sold_out: event.soldOut }).eq("sku", event.sku);
        if (error) throw error;
        revalidateTag(MENU_TAG, { expire: 0 });
        break;
      }
      case "product.stock_changed": {
        const { error } = await store.from("products").update({ stock_qty: event.qtyOnHand }).eq("sku", event.sku);
        if (error) throw error;
        revalidateTag(MENU_TAG, { expire: 0 });
        break;
      }
    }
    await store.from("webhook_inbox").update({ processed_at: new Date().toISOString() }).eq("event_id", event.eventId);
  } catch (e) {
    await store.from("webhook_inbox").delete().eq("event_id", event.eventId);
    throw e;
  }
}
