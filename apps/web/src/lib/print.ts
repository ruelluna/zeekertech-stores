"use client";

export type PrintKind = "ticket" | "labels";

/**
 * Prints an order's kitchen ticket or labels without leaving the page: loads the print view in an
 * off-screen frame, which opens the print dialog (or prints silently in Chrome kiosk-printing mode).
 */
export function printOrder(orderId: string, kind: PrintKind): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:400px;height:600px;border:0;opacity:0;pointer-events:none;";
  frame.src = `/admin/print/${orderId}?type=${kind}&autoprint=1`;
  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    frame.remove();
  };
  const onMessage = (e: MessageEvent) => {
    if (e.source === frame.contentWindow && e.data?.type === "wfh-printed") setTimeout(cleanup, 500);
  };
  window.addEventListener("message", onMessage);
  setTimeout(cleanup, 120_000); // safety net if the dialog is never closed
  document.body.appendChild(frame);
}

export interface AutoPrintPrefs {
  labels: boolean;
}

const KEY = "wfh-autoprint-v1";

/** Auto-print is per device: only the kitchen's computer/tablet should print new orders. */
export function autoPrintRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

export function parseAutoPrint(raw: string): AutoPrintPrefs {
  try {
    const p = JSON.parse(raw) as Partial<AutoPrintPrefs>;
    return { labels: Boolean(p.labels) };
  } catch {
    return { labels: false };
  }
}

const listeners = new Set<() => void>();
export const autoPrintStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(prefs: AutoPrintPrefs) {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Storage unavailable: auto-print stays off.
    }
    for (const l of listeners) l();
  },
};
