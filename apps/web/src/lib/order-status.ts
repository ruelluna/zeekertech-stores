import type { OrderStatus } from "@wfh/shared";

/** Customer-facing wording for each order status. */
export const STATUS_TEXT: Record<OrderStatus, { title: string; body: string }> = {
  received: { title: "Order received", body: "We've got your order." },
  awaiting_availability: { title: "Checking availability", body: "We're checking that we can get every item. You'll pay only after we confirm." },
  awaiting_customer: { title: "Please review your order", body: "Some items or prices changed. Continue or cancel." },
  pending_payment: { title: "Ready for payment", body: "Pay with GCash and send us the reference number." },
  queued: { title: "Payment confirmed", body: "Your order is confirmed and in our queue." },
  preparing: { title: "Preparing", body: "We're cooking your order." },
  ready: { title: "Ready", body: "Your order is ready." },
  out_for_delivery: { title: "Out for delivery", body: "Our rider is on the way." },
  delivered: { title: "Delivered", body: "Enjoy your food! Salamat!" },
  picked_up: { title: "Picked up", body: "Enjoy your food! Salamat!" },
  completed: { title: "Completed", body: "Salamat!" },
  denied: { title: "Sorry, we couldn't source the ingredients", body: "Nothing was charged." },
  rejected: { title: "Payment not accepted", body: "We couldn't confirm your payment. Please contact us." },
  cancelled: { title: "Cancelled", body: "This order was cancelled." },
  expired: { title: "Expired", body: "We didn't hear back in time, so this order was cancelled." },
};
