"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ProductType, PriceMode, SoldBy } from "@wfh/shared";
import { fail, form, formObject, ok, zodMessage, type ActionState } from "@/lib/action-state";
import { requireOwner } from "@/lib/auth";
import { menuChanged } from "@/lib/menu-tag";
import { uploadPublicImage } from "@/lib/uploads";

const PriceInput = z.object({
  id: z.uuid(),
  price: form.num.pipe(z.number().nonnegative().nullable()),
  estimated_price: form.num.pipe(z.number().nonnegative().nullable()),
});

/** Quick price edit from the menu list. */
export async function updatePrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = PriceInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase } = await requireOwner();
  const { id, ...prices } = parsed.data;
  const { error } = await supabase.schema("store").from("products").update(prices).eq("id", id);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const ProductInput = z
  .object({
    id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    sku: form.text.pipe(z.string().regex(/^[A-Z0-9-]+$/, "Use capital letters, numbers and dashes (e.g. CHF-PORK)")),
    name: form.text.pipe(z.string().min(1, "Required")),
    description: form.optText,
    category_id: z.uuid(),
    type: ProductType,
    price_mode: PriceMode,
    sold_by: SoldBy,
    price: form.num.pipe(z.number().nonnegative().nullable()),
    estimated_price: form.num.pipe(z.number().nonnegative().nullable()),
    weight_options_kg: form.text.transform((s, ctx) => {
      const values = s.split(/[,\s]+/).filter(Boolean).map(Number);
      if (values.some((n) => !(n > 0))) {
        ctx.addIssue({ code: "custom", message: "Use positive numbers separated by commas, e.g. 0.5, 1, 1.5" });
        return z.NEVER;
      }
      return values;
    }),
    prep_minutes: form.int.pipe(z.number().int().nonnegative().nullable()),
    sort_order: form.int.pipe(z.number().int().nullable()).transform((n) => n ?? 0),
    stock_tracked: form.bool,
    active: form.bool,
  })
  .refine((p) => p.sold_by === "unit" || p.weight_options_kg.length > 0, {
    message: "Items sold by weight need at least one weight option",
    path: ["weight_options_kg"],
  });

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ProductInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const ingredientIds = z.array(z.uuid()).safeParse(formData.getAll("ingredient_ids"));
  const groupIds = z.array(z.uuid()).safeParse(formData.getAll("group_ids"));
  if (!ingredientIds.success || !groupIds.success) return fail("Invalid ingredient or add-on selection");

  const { supabase } = await requireOwner();
  const store = supabase.schema("store");
  const { id, ...fields } = parsed.data;

  const { data: saved, error } = id
    ? await store.from("products").update(fields).eq("id", id).select("id").single()
    : await store.from("products").insert(fields).select("id").single();
  if (error) return fail(error.code === "23505" ? "That SKU is already used by another product" : error.message);

  // Replace ingredient and add-on links with the submitted selection.
  const productId = saved.id;
  const { error: delIngError } = await store.from("product_ingredients").delete().eq("product_id", productId);
  const { error: delGroupError } = await store.from("product_modifier_groups").delete().eq("product_id", productId);
  if (delIngError || delGroupError) return fail((delIngError ?? delGroupError)!.message);

  if (ingredientIds.data.length) {
    const { error: e } = await store
      .from("product_ingredients")
      .insert(ingredientIds.data.map((ingredient_id) => ({ product_id: productId, ingredient_id })));
    if (e) return fail(e.message);
  }
  if (groupIds.data.length) {
    const { error: e } = await store
      .from("product_modifier_groups")
      .insert(
        groupIds.data.map((group_id, i) => {
          // Optional condition: show this group only when an option from another linked group is picked.
          const showWhen = z.uuid().safeParse(formData.get(`show_when_${group_id}`));
          return { product_id: productId, group_id, sort_order: i + 1, show_when_modifier_id: showWhen.success ? showWhen.data : null };
        }),
      );
    if (e) return fail(e.message);
  }

  menuChanged();
  if (!id) redirect(`/admin/menu/${productId}`);
  return ok();
}

const CategoryInput = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  name: form.text.pipe(z.string().min(1, "Required")),
  sort_order: form.int.pipe(z.number().int().nullable()).transform((n) => n ?? 0),
  active: form.bool,
});

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = CategoryInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const categories = supabase.schema("store").from("categories");
  const { error } = id ? await categories.update(fields).eq("id", id) : await categories.insert(fields);
  if (error) return fail(error.code === "23505" ? "A category with that name already exists" : error.message);

  menuChanged();
  return ok(id ? "Saved" : "Category added");
}

export async function uploadProductPhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Invalid product");
  const { supabase } = await requireOwner();
  const products = supabase.schema("store").from("products");

  if (formData.get("remove") === "1") {
    const { error } = await products.update({ image_url: null }).eq("id", id.data);
    if (error) return fail(error.message);
    menuChanged();
    return ok("Photo removed");
  }

  const file = formData.get("photo");
  if (!(file instanceof File)) return fail("Choose a photo");
  const uploaded = await uploadPublicImage(file, "products");
  if (!uploaded.ok) return fail(uploaded.error);
  const { error } = await products.update({ image_url: uploaded.url }).eq("id", id.data);
  if (error) return fail(error.message);
  menuChanged();
  return ok("Photo uploaded");
}
