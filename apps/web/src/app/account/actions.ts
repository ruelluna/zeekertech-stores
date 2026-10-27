"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { normalizePhMobile } from "@wfh/shared";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { getCurrentCustomer } from "@/lib/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account");
  return customer;
}

const ProfileInput = z.object({ name: z.string().trim().min(1, "Enter your name").max(80), phone: z.string().trim() });

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const customer = await requireCustomer();
  const parsed = ProfileInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details");
  const phone = parsed.data.phone ? normalizePhMobile(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return fail("Enter a valid mobile number, e.g. 0917 123 4567");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("store").from("customers").update({ name: parsed.data.name, phone }).eq("id", customer.id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function deleteAddress(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCustomer();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Invalid address");
  // Row-level security limits this to the customer's own addresses.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("store").from("customer_addresses").delete().eq("id", id.data);
  if (error) return fail(error.message);
  refresh();
  return ok("Removed");
}

export async function setDefaultAddress(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const customer = await requireCustomer();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Invalid address");
  const addresses = (await createSupabaseServerClient()).schema("store").from("customer_addresses");
  await addresses.update({ is_default: false }).eq("customer_id", customer.id);
  const { error } = await addresses.update({ is_default: true }).eq("id", id.data);
  if (error) return fail(error.message);
  refresh();
  return ok("Default address set");
}

/**
 * Deletes the login, saved addresses and profile details (PLAN.md §14). Past orders are kept for the
 * business's records.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const customer = await requireCustomer();
  if (formData.get("confirm") !== "DELETE") return fail('Type DELETE to confirm');
  if (customer.isStaff) return fail("Staff accounts can't be deleted here.");

  const admin = createSupabaseAdminClient();
  const store = admin.schema("store");
  await store.from("customer_addresses").delete().eq("customer_id", customer.id);
  await store.from("push_subscriptions").delete().eq("customer_id", customer.id);
  await store
    .from("customers")
    .update({ name: "Deleted customer", email: null, phone: null, avatar_url: null, facebook_id: null, is_registered: false })
    .eq("id", customer.id);
  const { error } = await admin.auth.admin.deleteUser(customer.userId);
  if (error) return fail("Couldn't delete the login. Please message us and we'll do it for you.");

  await (await createSupabaseServerClient()).auth.signOut();
  redirect("/?deleted=1");
}
