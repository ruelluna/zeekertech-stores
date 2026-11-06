// What the Orders and Past orders pages, and the actions behind them, agree on about an order's status.

export const FINISHED_STATUSES = ["delivered", "picked_up", "completed", "denied", "rejected", "cancelled", "expired"] as const;

export function isFinished(status: string): boolean {
  return (FINISHED_STATUSES as readonly string[]).includes(status);
}

/** Finished orders stay on the Orders page until this time, then move to Past orders. Runs per request. */
export function finishedCutoff(): string {
  return new Date(Date.now() - 24 * 3600_000).toISOString();
}

/**
 * A rider account still waiting on pay for this delivery. Riders typed in as "someone else" have no account or
 * payout record (they're paid on the spot), so nothing can be outstanding for them.
 */
export function owesRider(order: { status: string; rider_id: string | null; rider_pay: number | null; rider_paid_out_at: string | null }): boolean {
  return order.status === "delivered" && order.rider_id !== null && Number(order.rider_pay ?? 0) > 0 && !order.rider_paid_out_at;
}

export const PAYMENT_LABEL: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "orange" }> = {
  not_requested: { label: "Pays after confirmation", tone: "neutral" },
  awaiting_payment: { label: "Not paid yet", tone: "amber" },
  submitted: { label: "Payment sent: check GCash", tone: "amber" },
  partial: { label: "Partly paid", tone: "red" },
  confirmed: { label: "Paid", tone: "green" },
  rejected: { label: "Payment rejected", tone: "red" },
};

export const STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "orange"; border?: string }> = {
  awaiting_availability: { label: "Checking availability", tone: "amber" },
  awaiting_customer: { label: "Waiting for customer", tone: "neutral" },
  pending_payment: { label: "Awaiting payment", tone: "amber" },
  queued: { label: "In queue", tone: "orange" },
  preparing: { label: "Preparing", tone: "orange" },
  ready: { label: "Ready", tone: "green" },
  out_for_delivery: { label: "Out for delivery", tone: "orange" },
  picked_up: { label: "✓ Picked up", tone: "green", border: "border-ink-200 border-l-green-600 dark:border-ink-700 dark:border-l-green-500" },
  delivered: { label: "✓ Delivered", tone: "green", border: "border-ink-200 border-l-green-600 dark:border-ink-700 dark:border-l-green-500" },
  completed: { label: "✓ Completed", tone: "green", border: "border-ink-200 border-l-green-600 dark:border-ink-700 dark:border-l-green-500" },
  cancelled: { label: "✕ Cancelled", tone: "red", border: "border-ink-200 border-l-red-600 dark:border-ink-700 dark:border-l-red-500" },
  expired: { label: "✕ Expired", tone: "red", border: "border-ink-200 border-l-red-600 dark:border-ink-700 dark:border-l-red-500" },
  denied: { label: "✕ Couldn't source", tone: "red", border: "border-ink-200 border-l-red-600 dark:border-ink-700 dark:border-l-red-500" },
  rejected: { label: "✕ Payment rejected", tone: "red", border: "border-ink-200 border-l-red-600 dark:border-ink-700 dark:border-l-red-500" },
};
