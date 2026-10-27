"use server";

import { z } from "zod";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export async function saveHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rows = [];
  for (let day = 0; day < 7; day++) {
    const row = z
      .object({ opens_at: time, closes_at: time, is_open: form.bool })
      .refine((r) => !r.is_open || r.opens_at < r.closes_at, { message: "Closing time must be after opening time" })
      .safeParse({
        opens_at: formData.get(`opens_at_${day}`),
        closes_at: formData.get(`closes_at_${day}`),
        is_open: formData.get(`is_open_${day}`),
      });
    if (!row.success) return fail(`${DAY_NAMES[day]}: ${row.error.issues[0]?.message}`);
    rows.push({ day_of_week: day, ...row.data });
  }

  const { supabase } = await requireOwner();
  const { error } = await supabase.schema("store").from("store_hours").upsert(rows);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const ClosureInput = z.object({ date: z.iso.date(), reason: form.optText });

export async function addClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ClosureInput.safeParse(formObject(formData));
  if (!parsed.success) return fail("Pick a date");

  const { supabase } = await requireOwner();
  const { error } = await supabase.schema("store").from("store_closures").upsert(parsed.data);
  if (error) return fail(error.message);

  menuChanged();
  return ok("Closed date added");
}

export async function removeClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = z.iso.date().safeParse(formData.get("date"));
  if (!date.success) return fail("Invalid date");

  const { supabase } = await requireOwner();
  const { error } = await supabase.schema("store").from("store_closures").delete().eq("date", date.data);
  if (error) return fail(error.message);

  menuChanged();
  return ok("Removed");
}

const minutes = form.int.pipe(z.number().int().min(0, "Can't be negative").nullable());

const SettingsInput = z.object({
  ordering_paused: form.bool,
  allow_preorders: form.bool,
  prep_lead_minutes: minutes,
  delivery_buffer_minutes: minutes,
  uncertain_items_cutoff: time,
  customer_decision_minutes: minutes,
  unpaid_flag_minutes: minutes,
  gcash_account_name: form.optText,
  pickup_instructions: form.optText,
});

export async function saveStoreSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SettingsInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const d = parsed.data;
  const { supabase } = await requireOwner();
  const { error } = await supabase
    .schema("store")
    .from("store_settings")
    .update({
      ...d,
      prep_lead_minutes: d.prep_lead_minutes ?? 30,
      delivery_buffer_minutes: d.delivery_buffer_minutes ?? 10,
      customer_decision_minutes: d.customer_decision_minutes ?? 30,
      unpaid_flag_minutes: d.unpaid_flag_minutes ?? 30,
    })
    .eq("id", true);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
