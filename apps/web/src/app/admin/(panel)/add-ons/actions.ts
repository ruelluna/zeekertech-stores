"use server";

import { z } from "zod";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";

const optionalId = z.uuid().optional().or(z.literal("").transform(() => undefined));

const GroupInput = z
  .object({
    id: optionalId,
    name: form.text.pipe(z.string().min(1, "Required")),
    required: form.bool,
    min_select: form.int.pipe(z.number().int().min(0).nullable()).transform((n) => n ?? 0),
    max_select: form.int.pipe(z.number().int().min(1).nullable()).transform((n) => n ?? 1),
  })
  .refine((g) => g.min_select <= g.max_select, { message: "Min can't be more than max", path: ["min_select"] })
  .transform((g) => ({ ...g, min_select: g.required ? Math.max(1, g.min_select) : g.min_select }));

export async function saveGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = GroupInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase, storeId } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const groups = supabase.schema("store").from("modifier_groups");
  const { error } = id
    ? await groups.update(fields).eq("id", id).eq("store_id", storeId)
    : await groups.insert({ ...fields, store_id: storeId });
  if (error) return fail(error.message);

  menuChanged();
  return ok(id ? "Saved" : "Group added");
}

const ModifierInput = z.object({
  id: optionalId,
  group_id: z.uuid(),
  name: form.text.pipe(z.string().min(1, "Required")),
  price_delta: form.num.pipe(z.number().nonnegative().nullable()),
  requires_cooking: form.bool,
  active: form.bool,
  sort_order: form.int.pipe(z.number().int().nullable()).transform((n) => n ?? 0),
});

export async function saveModifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ModifierInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase, storeId } = await requireOwner();
  const { id, ...fields } = parsed.data;
  // The option's group must belong to the store being worked in.
  const { data: group } = await supabase.schema("store").from("modifier_groups").select("id").eq("id", fields.group_id).eq("store_id", storeId).maybeSingle();
  if (!group) return fail("That add-on group isn't in this store");
  const modifiers = supabase.schema("store").from("modifiers");
  const { error } = id ? await modifiers.update(fields).eq("id", id) : await modifiers.insert(fields);
  if (error) return fail(error.code === "23505" ? "This group already has an option with that name" : error.message);

  menuChanged();
  return ok(id ? "Saved" : "Option added");
}
