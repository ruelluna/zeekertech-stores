import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";

export type StaffRole = "owner" | "verifier" | "kitchen" | "counter";

/** Admin pages each role can open (the nav shows the same list). */
export const ROLE_PAGES: Record<StaffRole, string[]> = {
  owner: ["orders", "inventory", "menu", "add-ons", "ingredients", "delivery", "hours", "promotions", "staff"],
  verifier: ["orders", "inventory"],
  kitchen: ["orders", "inventory"],
  counter: ["orders", "inventory"],
};

/** The signed-in staff member's role, or null (not signed in, or not staff). Request-time only. */
export async function currentStaffRole(): Promise<StaffRole | null> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const { data: role } = await supabase.schema("ops").rpc("current_staff_role");
  return (role as StaffRole | null) ?? null;
}

/**
 * Data access layer for the admin: returns a Supabase client acting as the signed-in staff member, or
 * redirects. Call it in every admin page and Server Action (row-level security backs it up). Staff
 * without access to a page go back to Orders; non-staff go to the sign-in page.
 */
export async function requireStaff(roles?: StaffRole[]) {
  // Session checks compare token expiry with the clock, so they must run per request, never in a prerender.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/admin/login");

  const { data: role } = await supabase.schema("ops").rpc("current_staff_role");
  if (!role) redirect("/admin/login?error=not_staff");
  if (roles && !roles.includes(role)) redirect("/admin/orders");

  return {
    supabase,
    userId: data.claims.sub,
    role: role as StaffRole,
    email: (data.claims.email as string | undefined) ?? null,
  };
}

/** Menu, settings and staff pages: owner only. */
export async function requireOwner() {
  return requireStaff(["owner"]);
}
