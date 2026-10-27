import "server-only";
import { flushOutboxes } from "./webhooks/outbox";
import { createSupabaseAdminClient } from "./supabase/admin";

const INTERVAL_MS = 30_000;

let flushing = false;
let again = false;

/** Delivers pending webhooks; overlapping calls are merged into one follow-up round. */
async function flushSoon(): Promise<void> {
  if (flushing) {
    again = true;
    return;
  }
  flushing = true;
  try {
    do {
      again = false;
      await flushOutboxes();
    } while (again);
  } catch (e) {
    console.error("[worker] flush", e instanceof Error ? e.message : e);
  } finally {
    flushing = false;
  }
}

/** Runs one full round: order timers, then webhook delivery (with retries). */
export async function runWorkerOnce(): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: settings } = await db.schema("store").from("store_settings").select("unpaid_flag_minutes").eq("id", true).maybeSingle();
  const { error } = await db.schema("ops").rpc("run_timers", { p_unpaid_flag_minutes: settings?.unpaid_flag_minutes ?? 30 });
  if (error) console.error("[worker] run_timers", error.message);
  await flushSoon();
}

/**
 * Background work for the self-hosted Node server (PLAN.md §17.4), started once from instrumentation.ts:
 *  - listens for new outbox rows over Supabase Realtime and delivers them immediately, so changes made
 *    anywhere (web admin, Android app, database timers) reach the other side within a second;
 *  - every 30 seconds, runs order timers and retries anything that failed.
 * The globalThis guard stops dev-mode reloads from starting a second copy.
 */
export function startWorker(): void {
  const g = globalThis as { __wfhWorker?: boolean };
  if (g.__wfhWorker || process.env.WFH_DISABLE_WORKER === "1") return;
  g.__wfhWorker = true;

  const db = createSupabaseAdminClient();
  db.channel("outbox-worker")
    .on("postgres_changes", { event: "INSERT", schema: "store", table: "webhook_outbox" }, () => void flushSoon())
    .on("postgres_changes", { event: "INSERT", schema: "ops", table: "webhook_outbox" }, () => void flushSoon())
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") void flushSoon();
      if (err) console.error("[worker] realtime", status, err.message);
    });

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runWorkerOnce();
    } catch (e) {
      console.error("[worker]", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);
}
