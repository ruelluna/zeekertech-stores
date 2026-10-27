import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  confirmWaitMinutes,
  menuBadge,
  type AvailabilityMode,
  type DailyStatus,
  type MenuBadge,
  type StoreHoursDay,
} from "@wfh/shared";
import { MENU_TAG } from "./menu-tag";
import { createSupabasePublicClient } from "./supabase/server";

export interface MenuOption {
  name: string;
  priceDelta: number;
  requiresCooking: boolean;
}

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: string;
  priceMode: "fixed" | "market";
  soldBy: "unit" | "weight";
  price: number | null;
  estimatedPrice: number | null;
  weightOptionsKg: number[];
  badge: MenuBadge;
  confirmWaitMinutes: number | null;
  /** Priced options only (unpriced ones aren't offered yet). */
  addOns: { group: string; required: boolean; options: MenuOption[] }[];
}

export interface PublicMenu {
  categories: { id: string; name: string; items: MenuItem[] }[];
  hours: StoreHoursDay[];
  closures: string[];
  orderingPaused: boolean;
  baseDeliveryFee: number;
}

/**
 * Everything the public menu shows, cached until an admin change (updateTag) or a few minutes
 * pass (today's ingredient status and frozen stock change from the staff app).
 */
export async function getPublicMenu(): Promise<PublicMenu> {
  "use cache";
  cacheTag(MENU_TAG);
  cacheLife("minutes");

  const store = createSupabasePublicClient().schema("store");
  const [categories, products, today, hours, closures, settings, delivery] = await Promise.all([
    store.from("categories").select("id, name").eq("active", true).order("sort_order"),
    store
      .from("products")
      .select(
        `id, sku, name, description, category_id, type, price_mode, sold_by, price, estimated_price, weight_options_kg,
         stock_tracked, stock_qty, sold_out, active, sort_order,
         product_ingredients(is_key, ingredients(id, availability_mode, default_wait_minutes)),
         product_modifier_groups(sort_order, modifier_groups(name, required, modifiers(name, price_delta, requires_cooking, active, sort_order)))`,
      )
      .eq("active", true)
      .order("sort_order"),
    store.from("ingredient_availability_today").select("ingredient_id, status"),
    store.from("store_hours").select("day_of_week, opens_at, closes_at, is_open"),
    store.from("store_closures").select("date"),
    store.from("store_settings").select("ordering_paused").eq("id", true).single(),
    store.from("delivery_settings").select("base_fee").eq("id", true).single(),
  ]);
  for (const r of [categories, products, today, hours, closures, settings, delivery]) if (r.error) throw r.error;

  const todayStatus = new Map<string, DailyStatus>(
    (today.data ?? []).filter((r) => r.ingredient_id && r.status).map((r) => [r.ingredient_id!, r.status!]),
  );

  const items = (products.data ?? []).map((p): MenuItem & { categoryId: string } => {
    const keyIngredients = p.product_ingredients
      .filter((l) => l.is_key && l.ingredients)
      .map((l) => ({
        availabilityMode: l.ingredients!.availability_mode as AvailabilityMode,
        defaultWaitMinutes: l.ingredients!.default_wait_minutes,
        todayStatus: todayStatus.get(l.ingredients!.id),
      }));
    const hasPrice = p.price_mode === "market" ? p.price !== null || p.estimated_price !== null : p.price !== null;

    return {
      categoryId: p.category_id,
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      type: p.type,
      priceMode: p.price_mode,
      soldBy: p.sold_by,
      price: p.price,
      estimatedPrice: p.estimated_price,
      weightOptionsKg: p.weight_options_kg,
      badge: menuBadge({
        active: p.active,
        hasPrice,
        soldOut: p.sold_out,
        stockTracked: p.stock_tracked,
        stockQty: p.stock_qty,
        keyIngredients,
      }),
      confirmWaitMinutes: confirmWaitMinutes(keyIngredients),
      addOns: [...p.product_modifier_groups]
        .sort((a, b) => a.sort_order - b.sort_order)
        .filter((l) => l.modifier_groups)
        .map((l) => ({
          group: l.modifier_groups!.name,
          required: l.modifier_groups!.required,
          options: [...l.modifier_groups!.modifiers]
            .filter((m) => m.active && m.price_delta !== null)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m) => ({ name: m.name, priceDelta: m.price_delta!, requiresCooking: m.requires_cooking })),
        }))
        .filter((g) => g.options.length > 0),
    };
  });

  return {
    categories: (categories.data ?? [])
      .map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.categoryId === c.id) }))
      .filter((c) => c.items.length > 0),
    hours: (hours.data ?? []).map((h) => ({
      dayOfWeek: h.day_of_week,
      opensAt: h.opens_at.slice(0, 5) as StoreHoursDay["opensAt"],
      closesAt: h.closes_at.slice(0, 5) as StoreHoursDay["closesAt"],
      isOpen: h.is_open,
    })),
    closures: (closures.data ?? []).map((c) => c.date),
    orderingPaused: settings.data?.ordering_paused ?? false,
    baseDeliveryFee: delivery.data?.base_fee ?? 30,
  };
}
