import "server-only";
import type { StaffRole } from "./auth";
import { createSupabaseAdminClient } from "./supabase/admin";

export type AddStaffResult = { ok: true; existed: boolean } | { ok: false; error: string };

/**
 * Creates a login (or finds the existing one for that email) and gives it a role in a store.
 * An existing login keeps its password.
 */
export async function addStaffLogin(input: {
  storeId: string;
  displayName: string;
  email: string;
  password: string;
  role: StaffRole;
}): Promise<AddStaffResult> {
  const admin = createSupabaseAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.displayName },
  });
  let userId = created.user?.id;
  if (error) {
    // Already has a login (e.g. a customer account, or staff in another store): add access to this store.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === input.email.toLowerCase())?.id;
    if (!userId) return { ok: false, error: error.message };
  }

  const { error: staffError } = await admin
    .schema("ops")
    .from("staff_users")
    .upsert({ user_id: userId!, store_id: input.storeId, display_name: input.displayName, role: input.role, active: true });
  if (staffError) return { ok: false, error: staffError.message };
  return { ok: true, existed: Boolean(error) };
}
