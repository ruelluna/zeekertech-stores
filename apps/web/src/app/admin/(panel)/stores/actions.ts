"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireSuperAdmin } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";
import { addStaffLogin } from "@/lib/staff-accounts";
import { DEFAULT_STORE_SLUG } from "@/lib/stores";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const StoreInput = z.object({
  name: form.text.pipe(z.string().min(1, "Enter the store name").max(80)),
  slug: form.text.pipe(
    z
      .string()
      .min(2, "The web address needs at least 2 characters")
      .max(40)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Web address: lowercase letters, numbers and single dashes, e.g. treatsbyyang"),
  ),
  tagline: form.optText,
  notice_days: form.int.pipe(z.number().int().min(0).max(60, "At most 60 days").nullable()).transform((n) => n ?? 0),
});

/**
 * Creates a store at /s/<slug> with its own settings: open 8 AM – 8 PM every day, pre-orders on, pickup only
 * (delivery fees and service area copied from Weekend Food Hub, ready to switch on), and texts off.
 */
export async function createStore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = StoreInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  await requireSuperAdmin();
  const { notice_days, ...fields } = parsed.data;

  const db = createSupabaseAdminClient();
  const store = db.schema("store");
  const { data: last } = await store.from("stores").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data: created, error } = await store
    .from("stores")
    .insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "That web address is already used by another store" : error.message);
  const storeId = created.id;

  const { data: template } = await store.from("stores").select("id").eq("slug", DEFAULT_STORE_SLUG).single();
  const [{ data: delivery }, { data: barangays }] = await Promise.all([
    store.from("delivery_settings").select("*").eq("store_id", template!.id).single(),
    store.from("barangays").select("name, active, center_lat, center_lng, is_island, notes, sort_order").eq("store_id", template!.id),
  ]);

  const steps = await Promise.all([
    store.from("store_settings").insert({
      store_id: storeId,
      allow_preorders: true,
      prep_lead_minutes: 0,
      slot_start_offset_minutes: 0,
      slot_end_offset_minutes: 0,
      notice_days,
    }),
    store.from("store_hours").insert([0, 1, 2, 3, 4, 5, 6].map((day) => ({ store_id: storeId, day_of_week: day, opens_at: "08:00", closes_at: "20:00", is_open: true }))),
    store.from("delivery_settings").insert({
      store_id: storeId,
      delivery_enabled: false,
      base_fee: delivery?.base_fee,
      included_km: delivery?.included_km,
      per_km: delivery?.per_km,
      round_to: delivery?.round_to,
      min_fee: delivery?.min_fee,
      max_km: delivery?.max_km,
      service_area_geojson: delivery?.service_area_geojson ?? null,
      excluded_areas_geojson: delivery?.excluded_areas_geojson ?? null,
      rider_share_percent: delivery?.rider_share_percent,
      rider_min_pay: delivery?.rider_min_pay,
    }),
    store.from("barangays").insert((barangays ?? []).map((b) => ({ ...b, store_id: storeId }))),
    db.schema("ops").from("sms_settings").insert({ store_id: storeId, enabled: false }),
  ]);
  const failed = steps.find((s) => s.error);
  if (failed?.error) {
    // Undo the half-made store so the web address can be used again.
    await Promise.all([
      store.from("store_settings").delete().eq("store_id", storeId),
      store.from("store_hours").delete().eq("store_id", storeId),
      store.from("delivery_settings").delete().eq("store_id", storeId),
      store.from("barangays").delete().eq("store_id", storeId),
      db.schema("ops").from("sms_settings").delete().eq("store_id", storeId),
    ]);
    await store.from("stores").delete().eq("id", storeId);
    return fail(failed.error.message);
  }

  menuChanged();
  return ok(`${fields.name} created at /s/${fields.slug}. Add its owner below.`);
}

const ActiveInput = z.object({ id: z.uuid(), active: form.bool });

/** Shows or hides a store. A hidden store's menu and checkout are offline; its admin still works. */
export async function setStoreActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ActiveInput.safeParse(formObject(formData));
  if (!parsed.success) return fail("Invalid store");
  await requireSuperAdmin();

  const store = createSupabaseAdminClient().schema("store").from("stores");
  const { data: target } = await store.select("slug").eq("id", parsed.data.id).single();
  if (target?.slug === DEFAULT_STORE_SLUG && !parsed.data.active) return fail("Weekend Food Hub is where the main address goes, so it can't be hidden");
  const { error } = await store.update({ active: parsed.data.active }).eq("id", parsed.data.id);
  if (error) return fail(error.message);
  menuChanged();
  return ok(parsed.data.active ? "Store is live" : "Store hidden");
}

const OwnerInput = z.object({
  storeId: z.uuid(),
  displayName: z.string().trim().min(1, "Enter a name").max(60),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Gives someone owner access to one store (a new login, or an existing one). */
export async function addStoreOwner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = OwnerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  await requireSuperAdmin();

  const result = await addStaffLogin({ ...parsed.data, role: "owner" });
  if (!result.ok) return fail(result.error);
  refresh();
  return ok(
    result.existed
      ? `${parsed.data.email} already had a login: owner access added (their password didn't change)`
      : `${parsed.data.displayName} can now sign in at /admin`,
  );
}
