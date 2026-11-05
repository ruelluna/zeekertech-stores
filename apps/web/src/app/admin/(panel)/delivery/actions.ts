"use server";

import { z } from "zod";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";

const peso = form.num.pipe(z.number().nonnegative().nullable());
const requiredPeso = form.num.pipe(z.number().nonnegative({ message: "Required" }));

const SettingsInput = z.object({
  delivery_enabled: form.bool,
  kitchen_address: form.optText,
  kitchen_lat: form.num.pipe(z.number().min(-90).max(90).nullable()),
  kitchen_lng: form.num.pipe(z.number().min(-180).max(180).nullable()),
  base_fee: requiredPeso,
  included_km: requiredPeso,
  per_km: requiredPeso,
  round_to: form.num.pipe(z.number().positive({ message: "Must be more than 0" })),
  min_fee: requiredPeso,
  max_km: form.num.pipe(z.number().positive({ message: "Must be more than 0" })),
  free_delivery_threshold: peso,
  rider_share_percent: form.num.pipe(z.number().min(0, "0–100%").max(100, "0–100%")),
  rider_min_pay: requiredPeso,
});

export async function saveDeliverySettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SettingsInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  if ((parsed.data.kitchen_lat === null) !== (parsed.data.kitchen_lng === null)) {
    return fail("Enter both latitude and longitude for the kitchen, or neither.");
  }

  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase.schema("store").from("delivery_settings").update(parsed.data).eq("store_id", storeId);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const BarangayInput = z.object({
  id: z.uuid(),
  active: form.bool,
  fee_override: peso,
  surcharge: peso,
  notes: form.optText,
});

export async function saveBarangay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = BarangayInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase, storeId } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const { error } = await supabase.schema("store").from("barangays").update(fields).eq("id", id).eq("store_id", storeId);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}
