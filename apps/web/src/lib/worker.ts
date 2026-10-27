import "server-only";
import { flushOutboxes } from "./webhooks/outbox";
import { createSupabaseAdminClient } from "./supabase/admin";

const INTERVAL_MS = 30_000;

/** Runs one round: deliver pending webhooks (with retries) and run order timers. */
export async function runWorkerOnce(): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: settings } = await db.schema("store").from("store_settings").select("unpaid_flag_minutes").eq("id", true).maybeSingle();
  const { error } = await db.schema("ops").rpc("run_timers", { p_unpaid_flag_minutes: settings?.unpaid_flag_minutes ?? 30 });
  if (error) console.error("[worker] run_timers", error.message);
  await flushOutboxes();
}

/**
 * Background loop for the self-hosted Node server (PLAN.md §17.4). Started once from instrumentation.ts;
 * the globalThis guard stops dev-mode reloads from starting a second loop.
 */
export function startWorker(): void {
  const g = globalThis as { __wfhWorker?: NodeJS.Timeout };
  if (g.__wfhWorker || process.env.WFH_DISABLE_WORKER === "1") return;
  let running = false;
  g.__wfhWorker = setInterval(async () => {
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
