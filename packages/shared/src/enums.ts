import { z } from "zod";

// Keep these lists in sync with the Postgres enums in supabase/migrations.

export const OrderStatus = z.enum([
  "received",
  "awaiting_availability",
  "awaiting_customer",
  "pending_payment",
  "queued",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "completed",
  "denied",
  "rejected",
  "cancelled",
  "expired",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "delivered",
  "picked_up",
  "completed",
  "denied",
  "rejected",
  "cancelled",
  "expired",
];

export const Fulfillment = z.enum(["pickup", "delivery"]);
export type Fulfillment = z.infer<typeof Fulfillment>;

export const OrderSource = z.enum(["web", "walk_in", "phone", "messenger"]);
export type OrderSource = z.infer<typeof OrderSource>;

export const PaymentMethod = z.enum(["gcash", "cash"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentStatus = z.enum([
  "not_requested",
  "awaiting_payment",
  "submitted",
  "partial",
  "confirmed",
  "rejected",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const ProductType = z.enum(["made_to_order", "ready_made", "frozen", "bundle"]);
export type ProductType = z.infer<typeof ProductType>;

export const PriceMode = z.enum(["fixed", "market"]);
export type PriceMode = z.infer<typeof PriceMode>;

export const SoldBy = z.enum(["unit", "weight"]);
export type SoldBy = z.infer<typeof SoldBy>;

export const AvailabilityMode = z.enum(["always", "subject_to_availability"]);
export type AvailabilityMode = z.infer<typeof AvailabilityMode>;

export const DailyStatus = z.enum(["available", "out", "unknown"]);
export type DailyStatus = z.infer<typeof DailyStatus>;

export const ItemAvailability = z.enum(["pending", "ready_to_cook", "cant_source"]);
export type ItemAvailability = z.infer<typeof ItemAvailability>;

export const ItemStatus = z.enum(["pending", "queued", "ready", "handed_over", "removed"]);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const StaffRole = z.enum(["owner", "verifier", "kitchen", "counter"]);
export type StaffRole = z.infer<typeof StaffRole>;

export const DistanceMethod = z.enum(["road", "straight_line"]);
export type DistanceMethod = z.infer<typeof DistanceMethod>;

export const FeeSource = z.enum(["formula", "barangay_override", "free_threshold", "manual"]);
export type FeeSource = z.infer<typeof FeeSource>;

export const CustomerDecision = z.enum(["continue", "cancel", "expired"]);
export type CustomerDecision = z.infer<typeof CustomerDecision>;

export const PromotionType = z.enum(["fixed", "percent"]);
export type PromotionType = z.infer<typeof PromotionType>;

export const PromotionTrigger = z.enum(["welcome", "code", "auto"]);
export type PromotionTrigger = z.infer<typeof PromotionTrigger>;
