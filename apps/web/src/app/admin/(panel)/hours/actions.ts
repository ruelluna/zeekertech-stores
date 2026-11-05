"use server";

import { z } from "zod";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";
import { uploadPublicImage } from "@/lib/uploads";

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

  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase
    .schema("store")
    .from("store_hours")
    .upsert(rows.map((r) => ({ ...r, store_id: storeId })));
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const ClosureInput = z.object({ date: z.iso.date(), reason: form.optText });

export async function addClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ClosureInput.safeParse(formObject(formData));
  if (!parsed.success) return fail("Pick a date");

  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase.schema("store").from("store_closures").upsert({ ...parsed.data, store_id: storeId });
  if (error) return fail(error.message);

  menuChanged();
  return ok("Closed date added");
}

export async function removeClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = z.iso.date().safeParse(formData.get("date"));
  if (!date.success) return fail("Invalid date");

  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase.schema("store").from("store_closures").delete().eq("store_id", storeId).eq("date", date.data);
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
  slot_start_offset_minutes: minutes,
  slot_end_offset_minutes: minutes,
  customer_decision_minutes: minutes,
  unpaid_flag_minutes: minutes,
  notice_days: form.int.pipe(z.number().int().min(0, "Can't be negative").max(60, "At most 60 days").nullable()),
  gcash_account_name: form.optText,
  pickup_instructions: form.optText,
});

export async function saveStoreSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SettingsInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const d = parsed.data;
  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase
    .schema("store")
    .from("store_settings")
    .update({
      ...d,
      prep_lead_minutes: d.prep_lead_minutes ?? 30,
      delivery_buffer_minutes: d.delivery_buffer_minutes ?? 10,
      slot_start_offset_minutes: d.slot_start_offset_minutes ?? 60,
      slot_end_offset_minutes: d.slot_end_offset_minutes ?? 60,
      customer_decision_minutes: d.customer_decision_minutes ?? 30,
      unpaid_flag_minutes: d.unpaid_flag_minutes ?? 30,
      notice_days: d.notice_days ?? 0,
    })
    .eq("store_id", storeId);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function uploadGcashQr(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, storeId } = await requireOwner();
  const file = formData.get("qr");
  if (!(file instanceof File)) return fail("Choose the QR image");
  const uploaded = await uploadPublicImage(file, "gcash");
  if (!uploaded.ok) return fail(uploaded.error);

  const { error } = await supabase.schema("store").from("store_settings").update({ gcash_qr_url: uploaded.url }).eq("store_id", storeId);
  if (error) return fail(error.message);
  menuChanged();
  return ok("QR code uploaded");
}

const PrintInput = z.object({
  print_label_width_mm: z.coerce.number().min(20).max(120),
  print_label_height_mm: z.coerce.number().min(15).max(120),
  print_labels_per_unit: form.bool,
});

export async function savePrintSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = PrintInput.safeParse(formObject(formData));
  if (!parsed.success) return fail("Check the paper sizes (labels: 20–120 mm wide, 15–120 mm tall)");
  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase.schema("store").from("store_settings").update(parsed.data).eq("store_id", storeId);
  if (error) return fail(error.message);
  return ok();
}

const ProfileInput = z.object({
  name: form.text.pipe(z.string().min(1, "Enter the store name").max(80)),
  tagline: form.optText,
});

/** The store's name and tagline, shown at the top of its menu. */
export async function saveStoreProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ProfileInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase.schema("store").from("stores").update(parsed.data).eq("id", storeId);
  if (error) return fail(error.message);
  menuChanged();
  return ok();
}
