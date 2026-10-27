"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/o/[token]/actions";

/** Re-fetches the order every few seconds while it can still change. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Notify me" for browser push. Hidden where push isn't supported or not configured. */
export function NotifyButton({ token }: { token: string }) {
  const [state, setState] = useState<"unsupported" | "idle" | "on" | "denied" | "working">("unsupported");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "idle");
    });
  }, [publicKey]);

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) }));
      const result = await savePushSubscription({ token, subscription: sub.toJSON() });
      setState(result.ok ? "on" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (state === "on") return <p className="text-sm text-green-700 dark:text-green-400">🔔 We&apos;ll notify you on this device when your order changes.</p>;
  if (state === "denied") return <p className="text-xs text-stone-500">Notifications are blocked in your browser. Keep this page open to see updates.</p>;
  return (
    <button
      type="button"
      onClick={enable}
      disabled={state === "working"}
      className="rounded-lg border border-orange-600 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-60 dark:hover:bg-orange-950"
    >
      🔔 Notify me about this order
    </button>
  );
}
