"use client";

import { useEffect, useState } from "react";
import { isStaffPushOn, removeStaffPush, saveStaffPush } from "@/app/admin/(panel)/push-actions";
import { urlBase64ToUint8Array } from "@/components/live";
import { publicEnv } from "@/lib/supabase/env";

/**
 * Turns on push alerts for this device (new orders needing a seafood check, payments to verify).
 * They arrive with the browser closed, so a phone buzzes like a text, for free.
 */
export function PhoneAlerts() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "working">(
    "unsupported",
  );
  const publicKey = publicEnv().vapidPublicKey;

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && (await isStaffPushOn(sub.endpoint)) ? "on" : "off");
    });
  }, [publicKey]);

  async function turnOn() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey!),
        }));
      const result = await saveStaffPush(sub.toJSON());
      setState(result.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    const sub = await (
      await navigator.serviceWorker.getRegistration("/sw.js")
    )?.pushManager.getSubscription();
    // Keep the browser subscription: it may also carry this device's customer order notifications.
    if (sub) await removeStaffPush(sub.endpoint);
    setState("off");
  }

  if (state === "unsupported") return null;
  if (state === "denied") {
    return (
      <p className="text-xs text-muted">
        Phone alerts are blocked in this browser&apos;s site settings.
      </p>
    );
  }
  if (state === "on") {
    return (
      <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        🔔 Phone alerts on for this device
        <button
          type="button"
          onClick={turnOff}
          className="text-xs text-muted underline hover:text-ink-700"
        >
          Turn off
        </button>
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={turnOn}
      disabled={state === "working"}
      className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent-soft disabled:opacity-60"
    >
      🔔 Turn on phone alerts
    </button>
  );
}
