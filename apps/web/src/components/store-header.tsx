import Link from "next/link";
import type { ReactNode } from "react";
import { storePath, type Store } from "@/lib/stores";

/**
 * Top of a store's pages: its name in brush script (or its logo), the tagline in stamped caps, and a
 * dotted rule in the store's accent (DESIGN.md: script for names, slab caps for facts).
 * On the menu ("lg") the store name is the page's h1; other pages ("sm") have their own h1 below.
 */
export function StoreHeader({ store, aside, size = "lg" }: { store: Store; aside?: ReactNode; size?: "lg" | "sm" }) {
  const big = size === "lg";
  const Name = big ? "h1" : "p";
  return (
    <header className={big ? "mb-8" : "mb-6"}>
      <div className="flex items-start justify-between gap-3">
        <Link href={storePath(store.slug)} className="min-w-0">
          {store.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo_url} alt={store.name} className={`${big ? "max-h-20" : "max-h-12"} max-w-full object-contain object-left`} />
          ) : (
            <Name className={`font-script leading-none text-foreground ${big ? "text-[2.75rem] sm:text-6xl" : "text-4xl"}`}>{store.name}</Name>
          )}
        </Link>
        {aside}
      </div>
      {big && store.tagline && <p className="stamp mt-3 text-xs text-ink-600 dark:text-ink-300">{store.tagline}</p>}
      <div className={`rule-dotted ${big ? "mt-3" : "mt-2"} w-full max-w-xs`} />
    </header>
  );
}
