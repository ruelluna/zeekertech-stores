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

/**
 * Creates or refreshes a signed-in user's customer profile in one store (Facebook, or the dev test
 * login). Customer accounts are separate per store, so the same login gets one profile per store.
 */
export async function ensureCustomer(user: User, storeId: string): Promise<void> {
  const db = createSupabaseAdminClient().schema("store");
  const facebook = user.identities?.find((i) => i.provider === "facebook");
  const meta = user.user_metadata ?? {};
  const name = (meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Customer") as string;

  const { data: existing } = await db.from("customers").select("id").eq("store_id", storeId).eq("user_id", user.id).maybeSingle();
  if (existing) {
    await db
      .from("customers")
      .update({ avatar_url: (meta.avatar_url as string | undefined) ?? null, email: user.email ?? null })
      .eq("id", existing.id);
    return;
  }
  await db.from("customers").insert({
    store_id: storeId,
    user_id: user.id,
    facebook_id: facebook?.id ?? null,
    name,
    email: user.email ?? null,
    avatar_url: (meta.avatar_url as string | undefined) ?? null,
    is_registered: true,
    privacy_consent_at: new Date().toISOString(),
  });
}

/**
 * The signed-in customer in a store, or null for guests. Someone signed in from another store gets a
 * profile in this one the first time they visit it. Request-time only.
 */
export async function getCurrentCustomer(storeId: string): Promise<Customer | null> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const find = () =>
    supabase
      .schema("store")
      .from("customers")
      .select("id, name, email, avatar_url, phone, created_at")
      .eq("store_id", storeId)
      .eq("user_id", data.user.id)
      .maybeSingle();
  let { data: row } = await find();
  if (!row) {
    // Only customers (who signed in through a storefront) get a profile here, not staff browsing the menu.
    const { count } = await createSupabaseAdminClient()
      .schema("store")
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id);
    if (!count) return null;
    await ensureCustomer(data.user, storeId);
    ({ data: row } = await find());
  }
  if (!row) return null;

  const { data: isStaff } = await supabase.schema("ops").rpc("is_store_staff", { p_store: storeId });
  return {
    id: row.id,
    userId: data.user.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    createdAt: row.created_at,
    isStaff: Boolean(isStaff),
  };
}
