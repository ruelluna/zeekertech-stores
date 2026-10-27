"use client";

import { useMemo, useSyncExternalStore } from "react";
import { autoPrintRaw, autoPrintStore, parseAutoPrint, printOrder } from "@/lib/print";

// Item labels are the kitchen's printout (one per item, and they double as the order ticket).

export function PrintButtons({ orderId }: { orderId: string }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:border-orange-500 dark:border-stone-700"
      onClick={() => printOrder(orderId, "labels")}
    >
      🏷 Print labels
    </button>
  );
}

/** Per-device setting: print an order's labels automatically when it reaches the kitchen queue. */
export function AutoPrintToggle() {
  const raw = useSyncExternalStore(autoPrintStore.subscribe, autoPrintRaw, () => "{}");
  const prefs = useMemo(() => parseAutoPrint(raw), [raw]);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="accent-orange-600" checked={prefs.labels} onChange={(e) => autoPrintStore.set({ labels: e.target.checked })} />
      <span>
        Auto-print labels on this device when an order reaches the kitchen
      </span>
    </label>
  );
}
