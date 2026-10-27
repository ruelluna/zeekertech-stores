import { smsPeso, type OrderStatus } from "@wfh/shared";
import type { AdminSmsKind, CustomerSmsKind } from "./sms";

// Wording of every text. Keep each under 160 characters (one SMS part) including a link on the real domain
// (about 70 characters); Admin → Texts shows each sample's length.

const STORE = "Weekend Food Hub";

type CustomerOrder = {
  code: string;
  total: number;
  fulfillment: "pickup" | "delivery";
  link: string;
};

/**
 * The text for a website order's status change, or null when the change isn't worth a text: routine steps,
 * and changes the customer made themselves on the order page (their status is already set before the echo).
 */
export function customerStatusText(
  status: OrderStatus,
  previous: OrderStatus,
  order: CustomerOrder,
  riderName?: string | null,
): { kind: CustomerSmsKind; message: string } | null {
  if (status === previous) return null;
  const { code, link } = order;
  switch (status) {
    case "awaiting_customer":
      return {
        kind: "customer_review",
        message: `${STORE}: Some items in ${code} changed. Continue or cancel here: ${link}`,
      };
    case "pending_payment":
      if (previous !== "awaiting_availability") return null;
      return {
        kind: "customer_review",
        message: `${STORE}: Seafood confirmed for ${code}. Please pay ${smsPeso(order.total)} by GCash: ${link}`,
      };
    case "queued":
      return {
        kind: "customer_payment_confirmed",
        message: `${STORE}: We received your payment for order ${code}. It's in the kitchen queue now. Salamat!`,
      };
    case "rejected":
      return {
        kind: "customer_payment_rejected",
        message: `${STORE}: We couldn't confirm your GCash payment for ${code}. Details: ${link}`,
      };
    case "ready":
      if (order.fulfillment !== "pickup") return null;
      return {
        kind: "customer_ready_pickup",
        message: `${STORE}: Your order ${code} is ready for pickup. See you soon!`,
      };
    case "out_for_delivery":
      return {
        kind: "customer_out_for_delivery",
        message: `${STORE}: ${riderName || "Our rider"} is on the way with order ${code}. Please keep your phone on. Salamat!`,
      };
    case "denied":
      return {
        kind: "customer_cancelled",
        message: `${STORE}: Sorry, we couldn't source the seafood for order ${code}, so it was cancelled. Nothing was charged.`,
      };
    case "expired":
      return {
        kind: "customer_cancelled",
        message: `${STORE}: Order ${code} was cancelled because we didn't hear back in time. You're welcome to order again.`,
      };
    case "cancelled":
      return {
        kind: "customer_cancelled",
        message: `${STORE}: Sorry, we had to cancel order ${code}. Please message our Facebook page if you have questions.`,
      };
    default:
      return null;
  }
}

const ADMIN = "WFH";

export function adminSeafoodCheckText(o: {
  code: string;
  customer: string;
  fulfillment: string;
  total: number;
  adminUrl: string;
}) {
  return {
    kind: "admin_seafood_check" as AdminSmsKind,
    message: `${ADMIN}: New order ${o.code} needs a seafood check. ${o.customer}, ${o.fulfillment}, ${smsPeso(o.total)}\n${o.adminUrl}`,
  };
}

export function adminPaymentText(o: {
  code: string;
  amount: number;
  referenceNo: string;
  senderName: string;
  adminUrl: string;
}) {
  return {
    kind: "admin_payment_to_verify" as AdminSmsKind,
    message: `${ADMIN}: GCash payment to verify for ${o.code}: ${smsPeso(o.amount)}, ref ${o.referenceNo}, from ${o.senderName}\n${o.adminUrl}`,
  };
}
