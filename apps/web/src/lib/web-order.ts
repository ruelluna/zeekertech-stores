import "server-only";
import { z } from "zod";
import { calculateDiscount, WebOrder, type OrderItem } from "@wfh/shared";
import { createSupabaseAdminClient } from "./supabase/admin";

export const AvailabilityResult = z.object({
  items: z.array(
    z.object({
      lineId: z.string(),
      status: z.enum(["ready_to_cook", "cant_source"]),
      finalUnitPrice: z.number().nullable(),
      substituteSku: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  requiresCustomerDecision: z.boolean(),
});
export type AvailabilityResult = z.infer<typeof AvailabilityResult>;

export async function loadWebOrderByToken(token: string) {
  if (!z.uuid().safeParse(token).success) return null;
  const { data, error } = await createSupabaseAdminClient().schema("store").from("web_orders").select("*").eq("access_token", token).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const order = WebOrder.safeParse(data.order);
  if (!order.success) return null;
  const availability = data.availability_result ? AvailabilityResult.safeParse(data.availability_result) : null;
  return { row: data, order: order.data, availability: availability?.success ? availability.data : null };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The cart after staff checked availability: unavailable items removed, market items at their
 * confirmed price, totals recalculated (discount re-applied with the same rule).
 */
export async function revisedOrder(order: WebOrder, availability: AvailabilityResult) {
  const results = new Map(availability.items.map((i) => [i.lineId, i]));
  const items: OrderItem[] = order.items
    .filter((i) => results.get(i.lineId)?.status !== "cant_source")
    .map((i) => {
      const r = results.get(i.lineId);
      if (i.priceMode !== "market") return i;
      const price = r?.finalUnitPrice ?? i.estimatedUnitPrice;
      return { ...i, unitPrice: price, estimatedUnitPrice: price };
    });

  const subtotal = round2(items.reduce((s, i) => s + (i.unitPrice ?? i.estimatedUnitPrice ?? 0) * i.qty, 0));
  let discount = order.totals.discount;
  if (discount) {
    const { data: promo } = await createSupabaseAdminClient()
      .schema("store")
      .from("promotions")
      .select("type, value, max_discount, min_order")
      .eq("id", discount.promotionId)
      .maybeSingle();
    const amount = promo
      ? calculateDiscount({ type: promo.type, value: promo.value, maxDiscount: promo.max_discount, minOrder: promo.min_order }, subtotal)
      : Math.min(discount.amount, subtotal);
    discount = amount > 0 ? { ...discount, amount } : null;
  }
  const total = round2(Math.max(0, subtotal - (discount?.amount ?? 0)) + order.totals.deliveryFee);
  return { items, totals: { subtotal, discount, deliveryFee: order.totals.deliveryFee, total, isEstimate: false } };
}
