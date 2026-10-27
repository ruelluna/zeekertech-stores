import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Data access layer for the admin: returns a Supabase client acting as the signed-in owner,
 * or redirects. Call it in every admin page and Server Action (row-level security backs it up).
 */
export async function requireOwner() {
  // Session checks compare token expiry with the clock, so they must run per request, never in a prerender.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/admin/login");

  const { data: role } = await supabase.schema("ops").rpc("current_staff_role");
  if (role !== "owner") redirect("/admin/login?error=not_owner");

  return { supabase, userId: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}
