"use client";

import { useEffect } from "react";

/** Opens the print dialog (when asked) and tells the parent frame once printing is done. */
export function PrintNow({ auto }: { auto: boolean }) {
  useEffect(() => {
    const done = () => window.parent?.postMessage({ type: "wfh-printed" }, window.location.origin);
    window.addEventListener("afterprint", done);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (auto) timer = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [auto]);

  return (
    <div className="mb-4 flex items-center gap-3 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded-lg bg-accent-button px-4 py-2 text-sm font-medium text-on-accent hover:brightness-95">
        Print
      </button>
      <span className="text-xs text-ink-500">In the print dialog: choose the printer, margins “None”, and turn off headers and footers.</span>
    </div>
  );
}
