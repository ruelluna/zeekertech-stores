import "server-only";
import { EVENT_ID_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER, signWebhook, type WebToOpsEvent } from "@wfh/shared";
import { createSupabaseAdminClient } from "../supabase/admin";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type NewWebEvent = DistributiveOmit<WebToOpsEvent, "eventId" | "occurredAt">;

const RETRY_MINUTES = [1, 5, 30, 120, 720];

function siteUrl() {
  return process.env.SITE_URL ?? "http://localhost:3100";
}

function secret() {
  const s = process.env.WEBHOOK_SIGNING_SECRET;
  if (!s) throw new Error("Missing WEBHOOK_SIGNING_SECRET. See apps/web/.env.example.");
  return s;
}

/** Queue a website → ordering-backend event. Deliver with flushOutboxes(). */
export async function enqueueWebEvent(event: NewWebEvent): Promise<void> {
  const eventId = `evt_${crypto.randomUUID().replaceAll("-", "")}`;
  const payload = { ...event, eventId, occurredAt: new Date().toISOString() };
  const { error } = await createSupabaseAdminClient()
    .schema("store")
    .from("webhook_outbox")
    .insert({ event_id: eventId, event_type: event.event, payload });
  if (error) throw error;
}

async function post(url: string, payload: unknown, eventId: string): Promise<string | null> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [EVENT_ID_HEADER]: eventId,
        [TIMESTAMP_HEADER]: String(ts),
        [SIGNATURE_HEADER]: await signWebhook(secret(), ts, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? null : `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Sends due events from both outboxes (website → ordering backend, and back), oldest first,
 * retrying failures with increasing delays. Safe to call often; called after writes and by the worker.
 */
export async function flushOutboxes(limit = 25): Promise<{ sent: number; failed: number }> {
  const db = createSupabaseAdminClient();
  let sent = 0;
  let failed = 0;

  for (const side of [
    { schema: "store" as const, url: `${siteUrl()}/api/webhooks/web` },
    { schema: "ops" as const, url: `${siteUrl()}/api/webhooks/ops` },
  ]) {
    const outbox = () => db.schema(side.schema).from("webhook_outbox");
    const { data: due, error } = await outbox()
      .select("id, event_id, payload, attempts")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("id")
      .limit(limit);
    if (error) throw error;

    for (const row of due ?? []) {
      const failure = await post(side.url, row.payload, row.event_id);
      if (failure === null) {
        sent++;
        await outbox().update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq("id", row.id);
      } else {
        failed++;
        const attempts = row.attempts + 1;
        const delay = RETRY_MINUTES[attempts - 1];
        await outbox()
          .update({
            attempts,
            last_error: failure,
            status: delay === undefined ? "failed" : "pending",
            next_attempt_at: new Date(Date.now() + (delay ?? 0) * 60_000).toISOString(),
          })
          .eq("id", row.id);
        // Keep order: don't send later events for this side until this one goes through.
        break;
      }
    }
  }
  return { sent, failed };
}
