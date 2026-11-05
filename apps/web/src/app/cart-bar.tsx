"use client";

import Link from "next/link";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { peso } from "@/components/ui";

/** Sticky bar at the bottom of a store's menu once something is in its cart. */
export function CartBar({ store }: { store: string }) {
  const lines = useCart(store);
  if (lines.length === 0) return null;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const estimate = lines.some((l) => l.isEstimate);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-surface p-3 dark:border-ink-800">
      <Link
        href={`/s/${store}/checkout`}
        className="mx-auto flex max-w-3xl items-center justify-between rounded-xl bg-accent-button px-4 py-3 font-medium text-on-accent hover:brightness-95"
      >
        <span>
          View cart · {count} item{count === 1 ? "" : "s"}
        </span>
        <span>
          {estimate ? "~" : ""}
          {peso(cartSubtotal(lines))}
        </span>
      </Link>
    </div>
  );
}
