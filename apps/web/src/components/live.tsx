"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { OrderStatus } from "@wfh/shared";
import { savePushSubscription } from "@/app/o/[token]/actions";
import { peso } from "@/components/ui";
import { STATUS_TEXT } from "@/lib/order-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { autoPrintRaw, parseAutoPrint, printOrder } from "@/lib/print";
import { chime, toast, type ToastTone } from "@/lib/toast";

/**
 * Reloads the page's server data whenever a Realtime channel reports a change (debounced), when the
 * tab becomes visible again, and on a slow fallback timer in case the connection drops silently.
 */
function useLiveRefresh(active: boolean, connect: (onChange: () => void) => RealtimeChannel, fallbackMs: number) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = connect(refresh);
    const fallback = setInterval(() => router.refresh(), fallbackMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", onVisible);
      void getSupabaseBrowserClient().removeChannel(channel);
    };
    // connect is defined inline by callers; the channel depends only on `active` and the ids they pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, router, fallbackMs]);
}

/** Keeps a ref in step with the latest server-rendered value, for comparing against live events. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

const STATUS_TONE: Partial<Record<OrderStatus, ToastTone>> = {
  queued: "success",
  ready: "success",
  out_for_delivery: "success",
  delivered: "success",
  picked_up: "success",
  completed: "success",
  awaiting_customer: "warning",
  pending_payment: "warning",
  denied: "error",
  rejected: "error",
  cancelled: "error",
  expired: "error",
};

/** Customer order page: live via a broadcast on the order's secret channel (works for guests), with toasts. */
export function LiveOrder({ token, active, status, paymentStatus }: { token: string; active: boolean; status: OrderStatus; paymentStatus: string }) {
  const last = useLatest({ status, paymentStatus });
  useLiveRefresh(
    active,
    (onChange) =>
      getSupabaseBrowserClient()
        .channel(`order:${token}`)
        .on("broadcast", { event: "changed" }, ({ payload }) => {
          const next = payload as { status?: OrderStatus; paymentStatus?: string };
          if (next.status && next.status !== last.current.status) {
            const text = STATUS_TEXT[next.status];
            toast({ title: text.title, body: text.body, tone: STATUS_TONE[next.status] ?? "info" });
          } else if (next.paymentStatus === "rejected" && last.current.paymentStatus !== "rejected") {
            toast({ title: "Payment not confirmed", body: "Please check the details below and send it again.", tone: "error" });
          }
          last.current = { status: next.status ?? last.current.status, paymentStatus: next.paymentStatus ?? last.current.paymentStatus };
          onChange();
        })
        .subscribe(),
    60_000,
  );
  return null;
}

export interface KnownOrder {
  status: string;
  paymentStatus: string;
  flags: string[];
}

type OpsOrderRow = {
  id: string;
  queue_code: string;
  status: string;
  payment_status: string;
  fulfillment: string;
  customer_name: string | null;
  customer_decision: string | null;
  total: number;
  flags: string[] | null;
  parent_order_id: string | null;
};

/**
 * Admin Orders page: live via database changes on ops orders (row-level security: staff only).
 * Toasts (and a chime) for what customers do: new orders, payments sent, decisions, cancellations.
 */
export function LiveOrders({ known }: { known: Record<string, KnownOrder> }) {
  const seen = useLatest(known);
  useLiveRefresh(
    true,
    (onChange) => {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel("admin-orders")
        .on("postgres_changes", { event: "*", schema: "ops", table: "orders" }, (change) => {
          const o = change.new as OpsOrderRow;
          const before = seen.current[o.id];
          const label = `${o.queue_code}`;
          if (change.eventType === "INSERT") {
            toast({
              title: o.parent_order_id ? `Add-on order ${label}` : `New order ${label}`,
              body: `${o.fulfillment === "delivery" ? "Delivery" : "Pickup"} · ${o.customer_name ?? "Walk-in"} · ${peso(o.total)}`,
            });
            chime();
          } else if (change.eventType === "UPDATE" && before) {
            if (o.payment_status === "submitted" && before.paymentStatus !== "submitted") {
              toast({ title: `Payment sent for ${label}`, body: `Check GCash for ${peso(o.total)}`, tone: "warning" });
              chime();
            } else if (o.status === "cancelled" && before.status !== "cancelled" && o.customer_decision === "cancel") {
              toast({ title: `${label} cancelled by the customer`, tone: "error" });
            } else if (o.status === "pending_payment" && before.status === "awaiting_customer" && o.customer_decision === "continue") {
              toast({ title: `${label}: customer continued`, body: "Waiting for their payment" });
            } else if (o.flags?.includes("customer_asked_to_cancel") && !before.flags.includes("customer_asked_to_cancel")) {
              toast({ title: `${label}: customer asked to cancel`, body: "It's already in the kitchen. Contact them.", tone: "warning" });
            }
          }
          // Auto-print (if this device opted in) when an order reaches the kitchen queue.
          const reachedKitchen =
            o?.status === "queued" && (change.eventType === "INSERT" || (change.eventType === "UPDATE" && before && before.status !== "queued"));
          if (reachedKitchen) {
            if (parseAutoPrint(autoPrintRaw()).labels) printOrder(o.id, "labels");
          }
          if (o?.id) {
            seen.current = { ...seen.current, [o.id]: { status: o.status, paymentStatus: o.payment_status, flags: o.flags ?? [] } };
          }
          onChange();
        })
        .on("postgres_changes", { event: "*", schema: "ops", table: "order_item_availability" }, onChange);
      // Row-level security checks the staff login, so attach it before subscribing (otherwise events
      // arrive as the anonymous role, without the order's details).
      void supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) await supabase.realtime.setAuth(data.session.access_token);
        channel.subscribe();
      });
      return channel;
    },
    60_000,
  );
  return null;
}

/**
 * Rider's page: live via their own orders (row-level security: only deliveries assigned to them),
 * with a toast and chime when a new one is assigned.
 */
export function LiveDeliveries({ known }: { known: Record<string, string> }) {
  const seen = useLatest(known);
  useLiveRefresh(
    true,
    (onChange) => {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase.channel("rider-deliveries").on("postgres_changes", { event: "*", schema: "ops", table: "orders" }, (change) => {
        const o = change.new as { id?: string; queue_code?: string; status?: string; barangay?: string | null };
        if (o?.id && o.status === "out_for_delivery" && seen.current[o.id] !== "out_for_delivery") {
          toast({ title: `New delivery ${o.queue_code}`, body: o.barangay ? `To ${o.barangay}` : undefined });
          chime();
        }
        if (o?.id && o.status) seen.current = { ...seen.current, [o.id]: o.status };
        onChange();
      });
      // Attach the rider's login first so row-level security sends their deliveries.
      void supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) await supabase.realtime.setAuth(data.session.access_token);
        channel.subscribe();
      });
      return channel;
    },
    60_000,
  );
  return null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Notify me" for browser push. Hidden where push isn't supported or not configured. */
export function NotifyButton({ token }: { token: string }) {
  const [state, setState] = useState<"unsupported" | "idle" | "on" | "denied" | "working">("unsupported");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "idle");
    });
  }, [publicKey]);

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) }));
      const result = await savePushSubscription({ token, subscription: sub.toJSON() });
      setState(result.ok ? "on" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (state === "on") return <p className="text-sm text-green-700 dark:text-green-400">🔔 We&apos;ll notify you on this device when your order changes.</p>;
  if (state === "denied") return <p className="text-xs text-stone-500">Notifications are blocked in your browser. Keep this page open to see updates.</p>;
  return (
    <button
      type="button"
      onClick={enable}
      disabled={state === "working"}
      className="rounded-lg border border-orange-600 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-60 dark:hover:bg-orange-950"
    >
      🔔 Notify me about this order
    </button>
  );
}
