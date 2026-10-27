"use client";

import Link from "next/link";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { peso } from "@/components/ui";

/** Sticky bar at the bottom of the menu once something is in the cart. */
export function CartBar() {
  const lines = useCart();
  if (lines.length === 0) return null;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const estimate = lines.some((l) => l.isEstimate);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
      <Link
        href="/checkout"
        className="mx-auto flex max-w-3xl items-center justify-between rounded-xl bg-orange-600 px-4 py-3 font-medium text-white hover:bg-orange-700"
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
