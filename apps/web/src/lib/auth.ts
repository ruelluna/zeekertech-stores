import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { listStores } from "./stores";
import { createSupabaseServerClient } from "./supabase/server";

export type StaffRole = "owner" | "verifier" | "kitchen" | "counter" | "rider";

/** Everyone except riders (who only see their own deliveries). The default for staff pages. */
export const KITCHEN_ROLES: StaffRole[] = ["owner", "verifier", "kitchen", "counter"];

/** Admin pages each role can open (the nav shows the same list). Super admins also get "stores". */
export const ROLE_PAGES: Record<StaffRole, string[]> = {
  owner: ["orders", "inventory", "deliveries", "menu", "add-ons", "ingredients", "delivery", "hours", "promotions", "texts", "staff"],
  verifier: ["orders", "inventory"],
  kitchen: ["orders", "inventory"],
  counter: ["orders", "inventory"],
  rider: ["deliveries"],
};

/** Cookie holding the store the admin is working in (for people in more than one store). */
export const ACTIVE_STORE_COOKIE = "admin_store";

export interface StaffStore {
  id: string;
  slug: string;
  name: string;
  role: StaffRole;
}

export interface StaffSession {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string | null;
  /** The store being worked in, and the person's role there. */
  store: StaffStore;
  storeId: string;
  role: StaffRole;
  /** Every store the person can open. */
  stores: StaffStore[];
  superAdmin: boolean;
}

/** The signed-in staff member and their active store, or null (not signed in, or not staff). Request-time only. */
export async function currentStaff(): Promise<StaffSession | null> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const userId = data.claims.sub;

  const [{ data: superAdmin }, { data: memberships }, allStores] = await Promise.all([
    supabase.schema("ops").rpc("is_super_admin"),
    supabase.schema("ops").from("staff_users").select("store_id, role").eq("user_id", userId).eq("active", true),
    listStores(),
  ]);

  // Super admins work in every store as owner; everyone else in the stores they belong to.
  const stores: StaffStore[] = superAdmin
    ? allStores.map((s) => ({ id: s.id, slug: s.slug, name: s.name, role: "owner" as const }))
    : (memberships ?? []).flatMap((m) => {
        const s = allStores.find((x) => x.id === m.store_id);
        return s ? [{ id: s.id, slug: s.slug, name: s.name, role: m.role as StaffRole }] : [];
      });
  if (stores.length === 0) return null;

  const wanted = (await cookies()).get(ACTIVE_STORE_COOKIE)?.value;
  const store = stores.find((s) => s.id === wanted) ?? stores[0]!;
  return {
    supabase,
    userId,
    email: (data.claims.email as string | undefined) ?? null,
    store,
    storeId: store.id,
    role: store.role,
    stores,
    superAdmin: Boolean(superAdmin),
  };
}

/**
 * Data access layer for the admin: returns a Supabase client acting as the signed-in staff member, the
 * store they're working in, or redirects. Call it in every admin page and Server Action, and filter
 * every query by `storeId` (row-level security backs it up). Staff without access to a page go to
 * their own start page; non-staff go to the sign-in page.
 */
export async function requireStaff(roles: StaffRole[] = KITCHEN_ROLES): Promise<StaffSession> {
  // Session checks compare token expiry with the clock, so they must run per request, never in a prerender.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/admin/login");

  const staff = await currentStaff();
  if (!staff) redirect("/admin/login?error=not_staff");
  if (!roles.includes(staff.role)) redirect(`/admin/${ROLE_PAGES[staff.role][0]}`);
  return staff;
}

/** Menu, settings and staff pages: the store's owner. */
export async function requireOwner() {
  return requireStaff(["owner"]);
}

/** Stores page: super admins only. */
export async function requireSuperAdmin() {
  const staff = await requireOwner();
  if (!staff.superAdmin) redirect("/admin/orders");
  return staff;
}
