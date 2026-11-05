"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { StaffRole } from "@wfh/shared";
import { fail, form, ok, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { addStaffLogin } from "@/lib/staff-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const password = z.string().min(8, "Password must be at least 8 characters");

const AddStaff = z.object({
  displayName: z.string().trim().min(1, "Enter a name").max(60),
  email: z.email("Enter a valid email"),
  password,
  role: StaffRole,
});

/**
 * True when the person is staff in this store and, unless the caller is a super admin, not a super admin
 * themselves. Staff actions use the service-role client, so this keeps each store's owner to their own people.
 */
async function managesStaff(storeId: string, userId: string, callerIsSuperAdmin: boolean): Promise<boolean> {
  const ops = createSupabaseAdminClient().schema("ops");
  const [{ data: member }, { data: superAdmin }] = await Promise.all([
    ops.from("staff_users").select("user_id").eq("store_id", storeId).eq("user_id", userId).maybeSingle(),
    ops.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  return Boolean(member) && (callerIsSuperAdmin || !superAdmin);
}

/** Creates a staff login (or gives an existing login staff access to this store) with a role. */
export async function addStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AddStaff.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  const { storeId } = await requireOwner();
  const { displayName, email, role } = parsed.data;

  const result = await addStaffLogin({ storeId, displayName, email, password: parsed.data.password, role });
  if (!result.ok) return fail(result.error);
  refresh();
  return ok(result.existed ? `${email} already had a login: staff access added (their password didn't change)` : `${displayName} added`);
}

const UpdateStaff = z.object({
  userId: z.uuid(),
  displayName: z.string().trim().min(1, "Enter a name").max(60),
  role: StaffRole,
  active: form.bool,
});

export async function updateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = UpdateStaff.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  const { userId: me, storeId } = await requireOwner();
  const { userId, displayName, role, active } = parsed.data;
  if (userId === me && (role !== "owner" || !active)) return fail("You can't remove your own owner access");

  const { error } = await createSupabaseAdminClient()
    .schema("ops")
    .from("staff_users")
    .update({ display_name: displayName, role, active })
    .eq("user_id", userId)
    .eq("store_id", storeId);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function resetStaffPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = z.uuid().safeParse(formData.get("userId"));
  const newPassword = password.safeParse(formData.get("password"));
  if (!userId.success) return fail("Invalid staff member");
  if (!newPassword.success) return fail(newPassword.error.issues[0]?.message ?? "Invalid password");
  const { storeId, superAdmin } = await requireOwner();
  if (!(await managesStaff(storeId, userId.data, superAdmin))) return fail("You can only change passwords for this store's staff");

  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userId.data, { password: newPassword.data });
  if (error) return fail(error.message);
  return ok("Password changed");
}

/** Marks all of a rider's delivered, unpaid trips as paid out (the owner hands over the money). */
export async function markRiderPaidOut(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const riderId = z.uuid().safeParse(formData.get("riderId"));
  if (!riderId.success) return fail("Invalid rider");
  const { storeId } = await requireOwner();

  const { data, error } = await createSupabaseAdminClient()
    .schema("ops")
    .from("orders")
    .update({ rider_paid_out_at: new Date().toISOString() })
    .eq("store_id", storeId)
    .eq("rider_id", riderId.data)
    .eq("status", "delivered")
    .is("rider_paid_out_at", null)
    .select("id");
  if (error) return fail(error.message);
  refresh();
  return ok(`Marked ${data.length} deliver${data.length === 1 ? "y" : "ies"} as paid out`);
}
