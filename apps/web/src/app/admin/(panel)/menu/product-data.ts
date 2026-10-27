import "server-only";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import type { ProductFormData } from "./product-form";

/** Everything the product form needs. Pass null to create a new product. */
export async function loadProductForm(productId: string | null): Promise<ProductFormData> {
  const { supabase } = await requireOwner();
  const store = supabase.schema("store");

  const [categories, ingredients, groups, product, links, groupLinks] = await Promise.all([
    store.from("categories").select("id, name").order("sort_order"),
    store.from("ingredients").select("id, name, availability_mode").order("name"),
    store.from("modifier_groups").select("id, name, modifiers(name, price_delta, sort_order)").order("name"),
    productId ? store.from("products").select("*").eq("id", productId).maybeSingle() : null,
    productId ? store.from("product_ingredients").select("ingredient_id").eq("product_id", productId) : null,
    productId ? store.from("product_modifier_groups").select("group_id").eq("product_id", productId) : null,
  ]);

  for (const r of [categories, ingredients, groups, product, links, groupLinks]) if (r?.error) throw r.error;
  if (productId && !product?.data) notFound();

  return {
    product: product?.data ?? null,
    categories: categories.data ?? [],
    ingredients: ingredients.data ?? [],
    groups: (groups.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      modifiers: [...g.modifiers].sort((a, b) => a.sort_order - b.sort_order),
    })),
    linkedIngredientIds: links?.data?.map((l) => l.ingredient_id) ?? [],
    linkedGroupIds: groupLinks?.data?.map((l) => l.group_id) ?? [],
  };
}
