"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { StaffRole } from "@wfh/shared";
import { fail, form, ok, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const password = z.string().min(8, "Password must be at least 8 characters");

const AddStaff = z.object({
  displayName: z.string().trim().min(1, "Enter a name").max(60),
  email: z.email("Enter a valid email"),
  password,
  role: StaffRole,
});

/** Creates a staff login (or gives an existing login staff access) with a role. */
export async function addStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AddStaff.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  await requireOwner();
  const { displayName, email, role } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  let userId = created.user?.id;
  if (error) {
    // Already has a login (e.g. a customer account): look it up and add staff access.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) return fail(error.message);
  }

  const { error: staffError } = await admin
    .schema("ops")
    .from("staff_users")
    .upsert({ user_id: userId!, display_name: displayName, role, active: true });
  if (staffError) return fail(staffError.message);
  refresh();
  return ok(error ? `${email} already had a login: staff access added (their password didn't change)` : `${displayName} added`);
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
  const { userId: me } = await requireOwner();
  const { userId, displayName, role, active } = parsed.data;
  if (userId === me && (role !== "owner" || !active)) return fail("You can't remove your own owner access");

  const { error } = await createSupabaseAdminClient()
    .schema("ops")
    .from("staff_users")
    .update({ display_name: displayName, role, active })
    .eq("user_id", userId);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function resetStaffPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = z.uuid().safeParse(formData.get("userId"));
  const newPassword = password.safeParse(formData.get("password"));
  if (!userId.success) return fail("Invalid staff member");
  if (!newPassword.success) return fail(newPassword.error.issues[0]?.message ?? "Invalid password");
  await requireOwner();

  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userId.data, { password: newPassword.data });
  if (error) return fail(error.message);
  return ok("Password changed");
}
