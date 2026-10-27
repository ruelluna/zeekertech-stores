import "server-only";
import webpush from "web-push";
import { createSupabaseAdminClient } from "./supabase/admin";

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:owner@example.com", publicKey!, privateKey!);
  return configured;
}

/** Sends a browser notification to everyone following this order (the guest's device or the customer's). */
export async function notifyOrder(webOrderId: string, customerId: string | null, message: { title: string; body: string; url: string }) {
  if (!configure()) return;
  const db = createSupabaseAdminClient().schema("store");
  const filter = customerId ? `web_order_id.eq.${webOrderId},customer_id.eq.${customerId}` : `web_order_id.eq.${webOrderId}`;
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").or(filter);

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), {
          TTL: 60 * 60,
        });
      } catch (e) {
        // 404/410: the browser dropped the subscription.
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
}
