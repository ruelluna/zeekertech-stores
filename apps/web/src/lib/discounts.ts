import "server-only";
import { calculateDiscount, haversineKm } from "@wfh/shared";
import type { Customer } from "./customer";
import { createSupabaseAdminClient } from "./supabase/admin";

export interface WelcomeOffer {
  promotionId: string;
  name: string;
  type: "fixed" | "percent";
  value: number;
  maxDiscount: number | null;
  minOrder: number | null;
}

/** The store's welcome discount this customer can still use, if any (PLAN.md §8). */
export async function welcomeOfferFor(customer: Customer | null, storeId: string): Promise<WelcomeOffer | null> {
  if (!customer) return null;
  const db = createSupabaseAdminClient().schema("store");
  const { data: promo } = await db
    .from("promotions")
    .select("id, name, type, value, max_discount, min_order, valid_days, per_customer_limit, starts_at, ends_at")
    .eq("store_id", storeId)
    .eq("trigger", "welcome")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!promo) return null;

  const now = Date.now();
  if (promo.starts_at && Date.parse(promo.starts_at) > now) return null;
  if (promo.ends_at && Date.parse(promo.ends_at) < now) return null;
  if (promo.valid_days && Date.parse(customer.createdAt) + promo.valid_days * 86_400_000 < now) return null;

  const { count } = await db
    .from("promotion_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("promotion_id", promo.id)
    .eq("customer_id", customer.id);
  if ((count ?? 0) >= promo.per_customer_limit) return null;

  return {
    promotionId: promo.id,
    name: promo.name,
    type: promo.type,
    value: promo.value,
    maxDiscount: promo.max_discount,
    minOrder: promo.min_order,
  };
}

export function discountAmount(offer: WelcomeOffer | null, subtotal: number): number {
  return offer ? calculateDiscount(offer, subtotal) : 0;
}

/**
 * Flags (never blocks) a welcome discount when the same mobile number or a delivery pin within ~30 m
 * was already used by another customer who redeemed it. Payment Review shows the flag.
 */
export async function duplicateDiscountFlag(input: {
  promotionId: string;
  customerId: string;
  phone: string;
  pin: { lat: number; lng: number } | null;
}): Promise<boolean> {
  const db = createSupabaseAdminClient().schema("store");
  const { data: redemptions } = await db
    .from("promotion_redemptions")
    .select("customer_id, web_orders(order)")
    .eq("promotion_id", input.promotionId)
    .neq("customer_id", input.customerId)
    .limit(500);

  return (redemptions ?? []).some((r) => {
    const order = r.web_orders?.order as { customer?: { phone?: string }; address?: { lat: number; lng: number } | null } | undefined;
    if (order?.customer?.phone === input.phone) return true;
    return Boolean(input.pin && order?.address && haversineKm(input.pin, order.address) < 0.03);
  });
}
