"use client";

import { useMemo, useSyncExternalStore } from "react";
import { autoPrintRaw, autoPrintStore, parseAutoPrint, printOrder } from "@/lib/print";

export function PrintButtons({ orderId }: { orderId: string }) {
  const button = "rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:border-orange-500 dark:border-stone-700";
  return (
    <div className="flex gap-2">
      <button type="button" className={button} onClick={() => printOrder(orderId, "ticket")}>
        🖨 Ticket
      </button>
      <button type="button" className={button} onClick={() => printOrder(orderId, "labels")}>
        🏷 Labels
      </button>
    </div>
  );
}

/** Per-device setting: print new kitchen orders automatically when they reach the queue. */
export function AutoPrintToggle() {
  const raw = useSyncExternalStore(autoPrintStore.subscribe, autoPrintRaw, () => "{}");
  const prefs = useMemo(() => parseAutoPrint(raw), [raw]);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="text-stone-500">Auto-print on this device when an order reaches the kitchen:</span>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" className="accent-orange-600" checked={prefs.tickets} onChange={(e) => autoPrintStore.set({ ...prefs, tickets: e.target.checked })} />
        Tickets
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" className="accent-orange-600" checked={prefs.labels} onChange={(e) => autoPrintStore.set({ ...prefs, labels: e.target.checked })} />
        Labels
      </label>
    </div>
  );
}
