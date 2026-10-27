import "server-only";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

export interface Customer {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  isStaff: boolean;
}

/** Creates or refreshes the customer profile for a signed-in user (Facebook, or the dev test login). */
export async function ensureCustomer(user: User): Promise<void> {
  const db = createSupabaseAdminClient().schema("store");
  const facebook = user.identities?.find((i) => i.provider === "facebook");
  const meta = user.user_metadata ?? {};
  const name = (meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Customer") as string;

  const { data: existing } = await db.from("customers").select("id").eq("user_id", user.id).maybeSingle();
  if (existing) {
    await db
      .from("customers")
      .update({ avatar_url: (meta.avatar_url as string | undefined) ?? null, email: user.email ?? null })
      .eq("id", existing.id);
    return;
  }
  await db.from("customers").insert({
    user_id: user.id,
    facebook_id: facebook?.id ?? null,
    name,
    email: user.email ?? null,
    avatar_url: (meta.avatar_url as string | undefined) ?? null,
    is_registered: true,
    privacy_consent_at: new Date().toISOString(),
  });
}

/** The signed-in customer, or null for guests. Request-time only. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: row } = await supabase
    .schema("store")
    .from("customers")
    .select("id, name, email, avatar_url, phone, created_at")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!row) return null;

  const { data: role } = await supabase.schema("ops").rpc("current_staff_role");
  return {
    id: row.id,
    userId: data.user.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    createdAt: row.created_at,
    isStaff: Boolean(role),
  };
}
