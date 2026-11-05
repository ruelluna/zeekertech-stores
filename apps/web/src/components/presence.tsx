"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Live visitors via Supabase Realtime Presence. Visitors share only the kind of page they're on;
// nothing is stored, and the count disappears when they leave.

const CHANNEL = "site-visitors";

export type VisitorPage = "menu" | "checkout" | "order" | "account" | "other";

type Visit = { page: VisitorPage; store: string | null };

/** The kind of page, and the store it belongs to (order pages at /o/… don't say which store). */
function visitOf(pathname: string): Visit {
  if (pathname.startsWith("/o/")) return { page: "order", store: null };
  const match = /^\/s\/([^/]+)(\/[^/]*)?/.exec(pathname);
  if (!match) return { page: "other", store: null };
  const rest = match[2] ?? "";
  const page: VisitorPage =
    rest === "" || rest === "/" ? "menu" : rest === "/checkout" ? "checkout" : rest === "/account" || rest === "/login" ? "account" : "other";
  return { page, store: match[1]! };
}

/** On every public page (root layout): reports this tab as a visitor. Admin pages aren't counted. */
export function TrackVisitor() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { page, store } = visitOf(pathname);

  // One presence entry per tab for as long as it stays on public pages.
  useEffect(() => {
    if (isAdmin) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(CHANNEL, { config: { presence: { key: crypto.randomUUID() } } });
    channelRef.current = channel;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track(visitOf(window.location.pathname));
    });
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Keep the page kind current as the visitor moves around.
  useEffect(() => {
    void channelRef.current?.track({ page, store });
  }, [page, store]);

  return null;
}

const PAGE_LABEL: Record<VisitorPage, string> = {
  menu: "browsing the menu",
  checkout: "at checkout",
  order: "viewing an order",
  account: "on their account / login",
  other: "elsewhere",
};

/** Admin header: how many people are on this store's pages right now, and where (order pages count for every store). */
export function LiveVisitors({ store }: { store: string }) {
  const [counts, setCounts] = useState<Record<VisitorPage, number> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(CHANNEL);
    channel
      .on("presence", { event: "sync" }, () => {
        const next: Record<VisitorPage, number> = { menu: 0, checkout: 0, order: 0, account: 0, other: 0 };
        for (const entries of Object.values(channel.presenceState<{ page?: VisitorPage; store?: string | null }>())) {
          // One key per tab; use its latest reported page.
          const latest = entries.at(-1);
          if (latest?.store && latest.store !== store) continue;
          const page = latest?.page ?? "other";
          next[page in next ? page : "other"]++;
        }
        setCounts(next);
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [store]);

  if (!counts) return null;
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const breakdown = (Object.keys(counts) as VisitorPage[])
    .filter((p) => counts[p] > 0)
    .map((p) => `${counts[p]} ${PAGE_LABEL[p]}`)
    .join("\n");

  return (
    <details className="relative text-sm">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
        title={breakdown || "No one on the site right now"}
        aria-live="polite"
      >
        <span className={`size-2 rounded-full ${total > 0 ? "animate-pulse bg-green-500" : "bg-stone-400"}`} aria-hidden="true" />
        {total} on the site now
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-stone-200 bg-white p-3 text-xs shadow-lg dark:border-stone-700 dark:bg-stone-900">
        {total === 0 ? (
          <p className="text-stone-500">No one on the site right now.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {(Object.keys(counts) as VisitorPage[])
              .filter((p) => counts[p] > 0)
              .map((p) => (
                <li key={p} className="flex justify-between gap-3">
                  <span className="text-stone-600 dark:text-stone-300">{PAGE_LABEL[p]}</span>
                  <strong>{counts[p]}</strong>
                </li>
              ))}
          </ul>
        )}
        <p className="mt-2 text-stone-400">Each open browser tab counts once. Staff pages aren&apos;t counted.</p>
      </div>
    </details>
  );
}
