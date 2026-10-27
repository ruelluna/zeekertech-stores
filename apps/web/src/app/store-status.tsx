"use client";

import { useEffect, useState } from "react";
import { formatManilaTime, manilaParts, storeStatus, type StoreHoursDay, type StoreStatus } from "@wfh/shared";

/** Live open/closed pill. Computed in the browser so the cached page never shows a stale time. */
export function StoreStatusPill({ hours, closures, paused }: { hours: StoreHoursDay[]; closures: string[]; paused: boolean }) {
  const [status, setStatus] = useState<StoreStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(storeStatus({ now: new Date(), hours, closures, paused }));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours, closures, paused]);

  if (!status) return <span className="inline-block h-7" />;

  const [tone, text] =
    status.state === "open"
      ? ["bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", `Open now · until ${formatManilaTime(status.closesAt)}`]
      : status.state === "paused"
        ? ["bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300", "Ordering paused for a while"]
        : ["bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300", closedLabel(status.opensAt)];

  return <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${tone}`}>{text}</span>;
}

function closedLabel(opensAt: Date | null): string {
  if (!opensAt) return "Closed";
  const today = manilaParts(new Date()).dateKey;
  const tomorrow = manilaParts(new Date(Date.now() + 86_400_000)).dateKey;
  const day = manilaParts(opensAt).dateKey;
  const when =
    day === today
      ? `today ${formatManilaTime(opensAt)}`
      : day === tomorrow
        ? `tomorrow ${formatManilaTime(opensAt)}`
        : `${opensAt.toLocaleDateString("en-PH", { weekday: "long", timeZone: "Asia/Manila" })} ${formatManilaTime(opensAt)}`;
  return `Closed · opens ${when}`;
}
