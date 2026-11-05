"use client";

/** Order links placed from this device, so guests can find their orders again. */
export interface RecentOrder {
  code: string;
  url: string;
  placedAt: string;
  /** Store slug. Missing on orders remembered before stores existed (Weekend Food Hub). */
  store?: string;
}

const KEY = "wfh-orders-v1";

/** The stored JSON string (a stable value for useSyncExternalStore). */
export function recentOrdersRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseRecentOrders(raw: string): RecentOrder[] {
  try {
    return JSON.parse(raw) as RecentOrder[];
  } catch {
    return [];
  }
}

export function rememberOrder(order: RecentOrder) {
  try {
    const existing = parseRecentOrders(recentOrdersRaw()).filter((o) => o.code !== order.code);
    localStorage.setItem(KEY, JSON.stringify([order, ...existing].slice(0, 20)));
  } catch {
    // Storage unavailable: the order page link still works.
  }
}
