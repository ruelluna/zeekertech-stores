"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "@wfh/shared";

/** A cart line plus what the cart needs to display it. The server re-prices everything at checkout. */
export interface CartEntry extends CartLine {
  name: string;
  optionLabels: string[];
  /** Unit price, or the estimate for market items. */
  displayUnitPrice: number;
  isEstimate: boolean;
  needsAvailability: boolean;
  requiresCooking: boolean;
  prepMinutes: number;
}

const KEY = "wfh-cart-v1";
const listeners = new Set<() => void>();
let cache: CartEntry[] | null = null;
const EMPTY: CartEntry[] = [];

function read(): CartEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CartEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: CartEntry[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage full: the cart still works for this visit.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const cart = {
  add(entry: CartEntry) {
    write([...read(), entry]);
  },
  setQty(lineId: string, qty: number) {
    write(qty <= 0 ? read().filter((l) => l.lineId !== lineId) : read().map((l) => (l.lineId === lineId ? { ...l, qty: Math.min(qty, 50) } : l)));
  },
  remove(lineId: string) {
    write(read().filter((l) => l.lineId !== lineId));
  },
  clear() {
    write([]);
  },
};

export function cartSubtotal(lines: CartEntry[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.displayUnitPrice * l.qty, 0) * 100) / 100;
}
