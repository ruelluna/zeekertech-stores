"use server";

import { z } from "zod";
import { PromotionTrigger, PromotionType } from "@wfh/shared";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";

const PromotionInput = z
  .object({
    id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    name: form.text.pipe(z.string().min(1, "Required")),
    type: PromotionType,
    value: form.num.pipe(z.number().positive({ message: "Must be more than 0" })),
    max_discount: form.num.pipe(z.number().positive().nullable()),
    min_order: form.num.pipe(z.number().nonnegative().nullable()),
    trigger: PromotionTrigger,
    code: form.optText.transform((c) => c?.toUpperCase() ?? null),
    per_customer_limit: form.int.pipe(z.number().int().positive().nullable()).transform((n) => n ?? 1),
    valid_days: form.int.pipe(z.number().int().positive().nullable()),
    active: form.bool,
  })
  .refine((p) => p.type !== "percent" || p.value <= 100, { message: "A percent discount can't be over 100", path: ["value"] })
  .refine((p) => p.trigger !== "code" || p.code, { message: "Promo codes need a code", path: ["code"] });

export async function savePromotion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = PromotionInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase, storeId } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const promotions = supabase.schema("store").from("promotions");
  const { error } = id
    ? await promotions.update(fields).eq("id", id).eq("store_id", storeId)
    : await promotions.insert({ ...fields, store_id: storeId });
  if (error) return fail(error.code === "23505" ? "That promo code is already used" : error.message);

  menuChanged();
  return ok(id ? "Saved" : "Promotion added");
}
