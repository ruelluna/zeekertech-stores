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
  /** Days of advance notice (cakes etc.). Missing in carts saved before made-to-order items. */
  noticeDays?: number;
}

export interface Cart {
  add(entry: CartEntry): void;
  setQty(lineId: string, qty: number): void;
  /** Swaps a line for its edited version, keeping its place in the cart. */
  replace(entry: CartEntry): void;
  remove(lineId: string): void;
  clear(): void;
}

// Each store has its own cart. Weekend Food Hub keeps the key from before stores existed, so carts in
// progress survive the switch.
const keyFor = (store: string) => (store === "weekendfoodhub" ? "wfh-cart-v1" : `wfh-cart-v1:${store}`);

const EMPTY: CartEntry[] = [];

interface CartStore extends Cart {
  read(): CartEntry[];
  subscribe(listener: () => void): () => void;
}

const stores = new Map<string, CartStore>();

function cartStore(store: string): CartStore {
  const existing = stores.get(store);
  if (existing) return existing;

  const key = keyFor(store);
  const listeners = new Set<() => void>();
  let cache: CartEntry[] | null = null;

  const read = (): CartEntry[] => {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as CartEntry[]) : [];
    } catch {
      cache = [];
    }
    return cache;
  };

  const write = (next: CartEntry[]) => {
    cache = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private mode or storage full: the cart still works for this visit.
    }
    for (const l of listeners) l();
  };

  const created: CartStore = {
    read,
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          cache = null;
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    add(entry) {
      write([...read(), entry]);
    },
    setQty(lineId, qty) {
      write(qty <= 0 ? read().filter((l) => l.lineId !== lineId) : read().map((l) => (l.lineId === lineId ? { ...l, qty: Math.min(qty, 50) } : l)));
    },
    replace(entry) {
      write(read().map((l) => (l.lineId === entry.lineId ? entry : l)));
    },
    remove(lineId) {
      write(read().filter((l) => l.lineId !== lineId));
    },
    clear() {
      write([]);
    },
  };
  stores.set(store, created);
  return created;
}

/** The cart actions for a store (by slug). */
export function cartFor(store: string): Cart {
  return cartStore(store);
}

/** A store's cart lines, kept in sync across tabs. */
export function useCart(store: string): CartEntry[] {
  const s = cartStore(store);
  return useSyncExternalStore(s.subscribe, s.read, () => EMPTY);
}

export function cartSubtotal(lines: CartEntry[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.displayUnitPrice * l.qty, 0) * 100) / 100;
}
