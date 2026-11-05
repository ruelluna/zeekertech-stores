import "server-only";
import type { StaffRole } from "./auth";
import { createSupabaseAdminClient } from "./supabase/admin";

export type AddStaffResult = { ok: true; existed: boolean } | { ok: false; error: string };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function findUserId(admin: Admin, email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

async function grantRole(admin: Admin, input: { userId: string; storeId: string; displayName: string; role: StaffRole }) {
  const { error } = await admin
    .schema("ops")
    .from("staff_users")
    .upsert({ user_id: input.userId, store_id: input.storeId, display_name: input.displayName, role: input.role, active: true });
  return error?.message ?? null;
}

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
  // Already has a login (e.g. a customer account, or staff in another store): add access to this store.
  const userId = created.user?.id ?? (error ? await findUserId(admin, input.email) : null);
  if (!userId) return { ok: false, error: error?.message ?? "Couldn't create the login" };

  const grantError = await grantRole(admin, { ...input, userId });
  if (grantError) return { ok: false, error: grantError };
  return { ok: true, existed: Boolean(error) };
}

export type InviteResult =
  | { ok: true; outcome: "emailed" | "existing" }
  /** The email couldn't be sent (e.g. no mail server set up): share this link with them yourself. */
  | { ok: true; outcome: "link"; link: string }
  | { ok: false; error: string };

/**
 * Invites someone by email to a role in a store: they get a link to set their own password, which lands
 * on `redirectTo`. Someone who already has a login just gets the role (and keeps their password).
 */
export async function inviteStaff(input: {
  storeId: string;
  displayName: string;
  email: string;
  role: StaffRole;
  redirectTo: string;
}): Promise<InviteResult> {
  const admin = createSupabaseAdminClient();
  const existing = await findUserId(admin, input.email);
  if (existing) {
    const grantError = await grantRole(admin, { ...input, userId: existing });
    return grantError ? { ok: false, error: grantError } : { ok: true, outcome: "existing" };
  }

  const options = { data: { full_name: input.displayName }, redirectTo: input.redirectTo };
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(input.email, options);
  if (invited.user) {
    const grantError = await grantRole(admin, { ...input, userId: invited.user.id });
    return grantError ? { ok: false, error: grantError } : { ok: true, outcome: "emailed" };
  }

  // Sending failed: make the same invite link without emailing it.
  console.error("[invite] email not sent:", error?.message);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "invite", email: input.email, options });
  if (!link.user || !link.properties) return { ok: false, error: linkError?.message ?? error?.message ?? "Couldn't create the invite" };
  const grantError = await grantRole(admin, { ...input, userId: link.user.id });
  return grantError ? { ok: false, error: grantError } : { ok: true, outcome: "link", link: link.properties.action_link };
}
