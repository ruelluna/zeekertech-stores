"use server";

import { z } from "zod";
import { AvailabilityMode } from "@wfh/shared";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";

const IngredientInput = z
  .object({
    id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    name: form.text.pipe(z.string().min(1, "Required")),
    key: form.optText,
    unit: form.optText,
    availability_mode: AvailabilityMode,
    default_wait_minutes: form.int.pipe(z.number().int().positive().nullable()),
  })
  .transform((i) => ({
    ...i,
    // New ingredients get a key from their name ("Mixed seafood" → "mixed_seafood"); keys never change after.
    key: i.key ?? i.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    default_wait_minutes: i.availability_mode === "always" ? null : i.default_wait_minutes,
  }));

export async function saveIngredient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = IngredientInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase } = await requireOwner();
  const { id, key, ...fields } = parsed.data;
  const ingredients = supabase.schema("store").from("ingredients");
  const { error } = id ? await ingredients.update(fields).eq("id", id) : await ingredients.insert({ ...fields, key });
  if (error) return fail(error.code === "23505" ? "An ingredient with that name already exists" : error.message);

  menuChanged();
  return ok(id ? "Saved" : "Ingredient added");
}
