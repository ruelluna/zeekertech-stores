import type { CSSProperties, ReactNode } from "react";
import { accentStyle } from "@wfh/shared";

/**
 * Sets one store's accent (CSS variables read by globals.css) on everything inside. Pages without a store
 * fall back to the default accent on :root.
 */
export function StoreTheme({ accent, className, children }: { accent: string | null | undefined; className?: string; children: ReactNode }) {
  return (
    <div className={`store-theme ${className ?? ""}`} style={accentStyle(accent) as CSSProperties}>
      {children}
    </div>
  );
}
