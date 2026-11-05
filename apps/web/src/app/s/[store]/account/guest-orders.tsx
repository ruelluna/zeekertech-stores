"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { recentOrdersRaw, parseRecentOrders } from "@/lib/recent-orders";

const noSubscribe = () => () => {};

/** A store's orders placed from this device (for guests, or orders placed before logging in). */
export function GuestOrders({ store }: { store: string }) {
  // Read from localStorage after hydration (null on the server).
  const raw = useSyncExternalStore(noSubscribe, recentOrdersRaw, () => null);
  // Orders remembered before stores existed are Weekend Food Hub's.
  const orders = useMemo(
    () => (raw === null ? null : parseRecentOrders(raw).filter((o) => (o.store ?? "weekendfoodhub") === store)),
    [raw, store],
  );
  if (!orders) return null;
  if (orders.length === 0) return <p className="text-sm text-stone-500">No orders from this device yet.</p>;
  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
      {orders.map((o) => (
        <li key={o.code} className="flex items-center justify-between py-2 text-sm">
          <span>
            <strong>{o.code}</strong>{" "}
            <span className="text-stone-500">{new Date(o.placedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })}</span>
          </span>
          <Link href={o.url} className="text-orange-700 hover:underline">
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}
