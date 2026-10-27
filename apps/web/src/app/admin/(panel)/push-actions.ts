"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Phone alerts for staff: this device's browser push subscription, tied to the signed-in staff member.

const Subscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function saveStaffPush(input: unknown): Promise<{ ok: boolean }> {
  const parsed = Subscription.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { userId } = await requireStaff();
  const { endpoint, keys } = parsed.data;
  const { error } = await createSupabaseAdminClient()
    .schema("ops")
    .from("staff_web_push")
    .upsert(
      { endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: "endpoint" },
    );
  return { ok: !error };
}

export async function removeStaffPush(endpoint: string): Promise<{ ok: boolean }> {
  const { userId } = await requireStaff();
  const { error } = await createSupabaseAdminClient()
    .schema("ops")
    .from("staff_web_push")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
  return { ok: !error };
}

/** Whether this device's subscription belongs to the signed-in staff member (it may be a customer subscription). */
export async function isStaffPushOn(endpoint: string): Promise<boolean> {
  const { userId } = await requireStaff();
  const { count } = await createSupabaseAdminClient()
    .schema("ops")
    .from("staff_web_push")
    .select("endpoint", { count: "exact", head: true })
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
  return Boolean(count);
}
