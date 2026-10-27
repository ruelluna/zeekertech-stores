import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wfh/shared";
import { supabaseConfig } from "./env";

/**
 * Server-only client with the secret key: bypasses row-level security. Use only after the code
 * has decided the caller may do this (order placement, webhooks, uploads, the worker).
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY. See apps/web/.env.example.");
  return createClient<Database>(supabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
