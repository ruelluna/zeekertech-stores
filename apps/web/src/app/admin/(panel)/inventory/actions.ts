"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner, requireStaff } from "@/lib/auth";

const amount = form.num.pipe(z.number().nonnegative("Counts can't be negative").nullable());

/** Saves the whole daily sheet (beginning, received, wasted, ending) for one date. */
export async function saveCounts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = z.iso.date().safeParse(formData.get("date"));
  const itemIds = z.array(z.uuid()).safeParse(formData.getAll("itemId"));
  if (!date.success || !itemIds.success) return fail("Invalid sheet");

  const { supabase, userId } = await requireStaff();
  const rows = [];
  for (const id of itemIds.data) {
    const parsed = z
      .object({ beginning: amount, received: amount, wasted: amount, ending: amount })
      .safeParse({
        beginning: formData.get(`beginning_${id}`),
        received: formData.get(`received_${id}`),
        wasted: formData.get(`wasted_${id}`),
        ending: formData.get(`ending_${id}`),
      });
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const c = parsed.data;
    // Skip untouched rows so empty days don't pile up.
    if (c.beginning === null && c.received === null && c.wasted === null && c.ending === null) continue;
    rows.push({
      date: date.data,
      item_id: id,
      beginning: c.beginning,
      received: c.received ?? 0,
      wasted: c.wasted ?? 0,
      ending: c.ending,
      counted_by: userId,
    });
  }
  if (rows.length) {
    const { error } = await supabase.schema("ops").from("inventory_counts").upsert(rows);
    if (error) return fail(error.message);
  }
  refresh();
  return ok(`Saved ${rows.length} item${rows.length === 1 ? "" : "s"}`);
}

const ItemInput = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  name: form.text.pipe(z.string().min(1, "Required")),
  unit: form.text.pipe(z.string().min(1, "Required").max(20)),
  category: form.text.transform((c) => c || "Other"),
  par_level: amount,
  reorder_point: amount,
  buy_for_days: form.int.pipe(z.number().int().min(1).max(14).nullable()).transform((n) => n ?? 1),
  sort_order: form.int.pipe(z.number().int().nullable()).transform((n) => n ?? 0),
  notes: form.optText,
  active: form.bool,
});

export async function saveItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ItemInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const items = supabase.schema("ops").from("inventory_items");
  const { error } = id ? await items.update(fields).eq("id", id) : await items.insert(fields);
  if (error) return fail(error.code === "23505" ? "An item with that name already exists" : error.message);
  refresh();
  return ok(id ? "Saved" : "Item added");
}
