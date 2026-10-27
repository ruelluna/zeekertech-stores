"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@wfh/shared";
import { supabaseConfig } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** One browser client per tab (shares the signed-in session cookie with the server). */
export function getSupabaseBrowserClient() {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
