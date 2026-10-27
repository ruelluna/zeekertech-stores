import { z } from "zod";
import { DailyStatus, ItemAvailability, OrderStatus } from "../enums";
import { OrderItem, Totals, WebOrder } from "../orders";

const Peso = z.number().nonnegative();

const base = <T extends string>(event: T) => ({
  eventId: z.string().min(1),
  event: z.literal(event),
  occurredAt: z.iso.datetime({ offset: true }),
});

// ── Web app → ordering backend ────────────────────────────────────────────────

export const OrderCreated = z.object({ ...base("order.created"), order: WebOrder });

export const OrderPaymentSubmitted = z.object({
  ...base("order.payment_submitted"),
  orderId: z.string().min(1),
  referenceNo: z.string().min(1),
  senderName: z.string().min(1),
  amount: Peso,
  /** Path in the private payment-proofs storage bucket. */
  proofPath: z.string().nullable(),
});

export const OrderCustomerContinued = z.object({
  ...base("order.customer_continued"),
  orderId: z.string().min(1),
  /** The cart after the customer removed or swapped unavailable items. */
  items: z.array(OrderItem).min(1),
  totals: Totals,
});

export const OrderCustomerCancelled = z.object({
  ...base("order.customer_cancelled"),
  orderId: z.string().min(1),
  reason: z.string().nullable(),
});

export const OrderCancelled = z.object({
  ...base("order.cancelled"),
  orderId: z.string().min(1),
  reason: z.string().min(1),
});

export const MenuUpdated = z.object({ ...base("menu.updated"), version: z.string().min(1) });

export const DeliverySettingsUpdated = z.object({
  ...base("delivery_settings.updated"),
  version: z.string().min(1),
});

export const WebToOpsEvent = z.discriminatedUnion("event", [
  OrderCreated,
  OrderPaymentSubmitted,
  OrderCustomerContinued,
  OrderCustomerCancelled,
  OrderCancelled,
  MenuUpdated,
  DeliverySettingsUpdated,
]);
export type WebToOpsEvent = z.infer<typeof WebToOpsEvent>;

// ── Ordering backend → web app ────────────────────────────────────────────────

export const OrderAvailabilityResult = z.object({
  ...base("order.availability_result"),
  orderId: z.string().min(1),
  items: z.array(
    z.object({
      lineId: z.uuid(),
      status: ItemAvailability.exclude(["pending"]),
      finalUnitPrice: Peso.nullable(),
      substituteSku: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  /** False when everything is available at the quoted price: the customer can pay straight away. */
  requiresCustomerDecision: z.boolean(),
});

export const OrderPaymentConfirmed = z.object({
  ...base("order.payment_confirmed"),
  orderId: z.string().min(1),
  amountReceived: Peso.nullable(),
  referenceNo: z.string().nullable(),
});

export const OrderPaymentRejected = z.object({
  ...base("order.payment_rejected"),
  orderId: z.string().min(1),
  reason: z.string().min(1),
});

export const OrderStatusChanged = z.object({
  ...base("order.status_changed"),
  orderId: z.string().min(1),
  status: OrderStatus,
  scheduledFor: z.iso.datetime({ offset: true }).nullable(),
  note: z.string().nullable(),
  /** Who is delivering, once the order is out for delivery. Optional for events sent before this field existed. */
  riderName: z.string().nullable().optional(),
});

export const OrderDeliveryFeeChanged = z.object({
  ...base("order.delivery_fee_changed"),
  orderId: z.string().min(1),
  deliveryFee: Peso,
  reason: z.string().min(1),
});

export const IngredientDailyStatusChanged = z.object({
  ...base("ingredient.daily_status_changed"),
  date: z.iso.date(),
  ingredientKey: z.string().min(1),
  status: DailyStatus,
  qtyAvailable: z.number().nonnegative().nullable(),
  marketPrice: Peso.nullable(),
});

export const ProductSoldOutChanged = z.object({
  ...base("product.sold_out_changed"),
  sku: z.string().min(1),
  soldOut: z.boolean(),
});

export const ProductStockChanged = z.object({
  ...base("product.stock_changed"),
  sku: z.string().min(1),
  qtyOnHand: z.number().int().nonnegative(),
});

export const OpsToWebEvent = z.discriminatedUnion("event", [
  OrderAvailabilityResult,
  OrderPaymentConfirmed,
  OrderPaymentRejected,
  OrderStatusChanged,
  OrderDeliveryFeeChanged,
  IngredientDailyStatusChanged,
  ProductSoldOutChanged,
  ProductStockChanged,
]);
export type OpsToWebEvent = z.infer<typeof OpsToWebEvent>;
