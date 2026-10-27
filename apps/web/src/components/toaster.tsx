"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { dismissToast, toastStore, type ToastTone } from "@/lib/toast";

const TONES: Record<ToastTone, string> = {
  info: "border-stone-300 dark:border-stone-600",
  success: "border-green-500",
  warning: "border-amber-500",
  error: "border-red-500",
};
const ICONS: Record<ToastTone, string> = { info: "🔔", success: "✅", warning: "⚠️", error: "⛔" };

const noToasts: never[] = [];

/** Toast stack: top of the screen on phones, bottom-right on larger screens. */
export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get, () => noToasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:items-end"
    >
      {toasts.map((t) => {
        const content = (
          <>
            <span aria-hidden="true">{ICONS[t.tone]}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t.title}</span>
              {t.body && <span className="block text-stone-600 dark:text-stone-400">{t.body}</span>}
            </span>
          </>
        );
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 bg-white p-3 text-sm shadow-lg ring-1 ring-black/5 dark:bg-stone-900 ${TONES[t.tone]}`}
          >
            {t.href ? (
              <Link href={t.href} className="flex min-w-0 flex-1 items-start gap-3" onClick={() => dismissToast(t.id)}>
                {content}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
            )}
            <button type="button" onClick={() => dismissToast(t.id)} className="text-lg leading-none text-stone-400 hover:text-stone-600" aria-label="Dismiss">
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
