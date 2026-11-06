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

  const { supabase, storeId } = await requireOwner();
  const { id, ...prices } = parsed.data;
  const { error } = await supabase.schema("store").from("products").update(prices).eq("id", id).eq("store_id", storeId);
  if (error) return fail(error.message);

  menuChanged();
  return ok();
}

const ActiveInput = z.object({ id: z.uuid(), active: form.bool });

/** Quick show/hide from the menu list. Hidden products can't be ordered. */
export async function setProductActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ActiveInput.safeParse(formObject(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase, storeId } = await requireOwner();
  const { error } = await supabase
    .schema("store")
    .from("products")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id)
    .eq("store_id", storeId);
  if (error) return fail(error.message);

  menuChanged();
  return ok(parsed.data.active ? "Shown on the menu" : "Hidden");
}

const ReorderInput = z.object({ categoryId: z.uuid(), productIds: z.array(z.uuid()).min(1) });

/** Saves a category's product order from the menu list's drag and drop. */
export async function reorderProducts(categoryId: string, productIds: string[]): Promise<ActionState> {
  const parsed = ReorderInput.safeParse({ categoryId, productIds });
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const { supabase, storeId } = await requireOwner();
  const store = supabase.schema("store");
  const { data: current, error } = await store
    .from("products")
    .select("id, sort_order")
    .eq("store_id", storeId)
    .eq("category_id", parsed.data.categoryId);
  if (error) return fail(error.message);

  // Another tab or person may have added or moved a product since this list loaded; show them the current list.
  const currentOrder = new Map(current.map((p) => [p.id, p.sort_order]));
  const ids = parsed.data.productIds;
  if (new Set(ids).size !== currentOrder.size || ids.some((id) => !currentOrder.has(id))) {
    menuChanged();
    return fail("This category changed while you were sorting. Check the list and try again.");
  }

  const results = await Promise.all(
    ids.flatMap((id, i) =>
      currentOrder.get(id) === i + 1
        ? []
        : [store.from("products").update({ sort_order: i + 1 }).eq("id", id).eq("store_id", storeId)],
    ),
  );

  // Refresh even after a failure: some rows may have saved, and the list should show what's really stored.
  menuChanged();
  const failed = results.find((r) => r.error);
  return failed ? fail(failed.error!.message) : ok("Order saved");
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
    notice_days: form.int.pipe(z.number().int().min(0).max(60, "At most 60 days").nullable()),
    daily_limit: form.int.pipe(z.number().int().min(1, "Max per day: at least 1, or leave it blank").max(10000).nullable()),
    note_prompt: form.optText,
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

  const { supabase, storeId } = await requireOwner();
  const store = supabase.schema("store");
  const { id, ...fields } = parsed.data;

  // The category, ingredients and add-on groups must all be the active store's.
  const [category, ownIngredients, ownGroups] = await Promise.all([
    store.from("categories").select("id").eq("id", fields.category_id).eq("store_id", storeId).maybeSingle(),
    store.from("ingredients").select("id").eq("store_id", storeId).in("id", ingredientIds.data),
    store.from("modifier_groups").select("id").eq("store_id", storeId).in("id", groupIds.data),
  ]);
  if (!category.data) return fail("Choose one of this store's categories");
  if ((ownIngredients.data ?? []).length !== ingredientIds.data.length || (ownGroups.data ?? []).length !== groupIds.data.length) {
    return fail("Some ingredients or add-ons aren't in this store");
  }

  const { data: saved, error } = id
    ? await store.from("products").update(fields).eq("id", id).eq("store_id", storeId).select("id").single()
    : await store.from("products").insert({ ...fields, store_id: storeId }).select("id").single();
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

  const { supabase, storeId } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const categories = supabase.schema("store").from("categories");
  const { error } = id
    ? await categories.update(fields).eq("id", id).eq("store_id", storeId)
    : await categories.insert({ ...fields, store_id: storeId });
  if (error) return fail(error.code === "23505" ? "A category with that name already exists" : error.message);

  menuChanged();
  return ok(id ? "Saved" : "Category added");
}

export async function uploadProductPhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Invalid product");
  const { supabase, storeId } = await requireOwner();
  const products = supabase.schema("store").from("products");

  if (formData.get("remove") === "1") {
    const { error } = await products.update({ image_url: null }).eq("id", id.data).eq("store_id", storeId);
    if (error) return fail(error.message);
    menuChanged();
    return ok("Photo removed");
  }

  const file = formData.get("photo");
  if (!(file instanceof File)) return fail("Choose a photo");
  const uploaded = await uploadPublicImage(file, "products");
  if (!uploaded.ok) return fail(uploaded.error);
  const { error } = await products.update({ image_url: uploaded.url }).eq("id", id.data).eq("store_id", storeId);
  if (error) return fail(error.message);
  menuChanged();
  return ok("Photo uploaded");
}
