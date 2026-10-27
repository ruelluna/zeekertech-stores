"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@wfh/shared";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** One browser client per tab (shares the signed-in session cookie with the server). */
export function getSupabaseBrowserClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
