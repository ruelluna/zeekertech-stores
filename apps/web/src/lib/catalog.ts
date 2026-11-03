import "server-only";
import {
  confirmWaitMinutes,
  menuBadge,
  type AvailabilityMode,
  type DailyStatus,
  type DeliverySettings,
  type PricingProduct,
  type ServiceAreaGeoJSON,
  type StoreHoursDay,
} from "@wfh/shared";
import { createSupabasePublicClient } from "./supabase/server";

export interface CatalogProduct extends PricingProduct {
  categoryId: string;
  description: string | null;
  imageUrl: string | null;
  confirmWaitMinutes: number | null;
  /** Label for the notes field, e.g. "Message on the cake". */
  notePrompt: string | null;
}

export interface CatalogBrand {
  id: string;
  name: string;
  tagline: string | null;
  noticeDays: number;
}

export interface Catalog {
  /** Null brandId = the main Weekend Food Hub menu. */
  categories: { id: string; name: string; brandId: string | null }[];
  /** Active sub-brands, in display order. */
  brands: CatalogBrand[];
  products: CatalogProduct[];
  hours: StoreHoursDay[];
  closures: string[];
  settings: {
    orderingPaused: boolean;
    allowPreorders: boolean;
    prepLeadMinutes: number;
    deliveryBufferMinutes: number;
    uncertainItemsCutoff: StoreHoursDay["opensAt"];
    slotStartOffsetMinutes: number;
    slotEndOffsetMinutes: number;
    customerDecisionMinutes: number;
    unpaidFlagMinutes: number;
    gcashQrUrl: string | null;
    gcashAccountName: string | null;
    pickupInstructions: string | null;
  };
  delivery: DeliverySettings & {
    kitchen: { lat: number; lng: number } | null;
    kitchenAddress: string | null;
    serviceArea: ServiceAreaGeoJSON | null;
    excludedAreas: ServiceAreaGeoJSON | null;
  };
  barangays: { id: string; name: string; center: { lat: number; lng: number } | null; feeOverride: number | null; surcharge: number | null }[];
}

const hhmm = (t: string) => t.slice(0, 5) as StoreHoursDay["opensAt"];

/** Fresh (uncached) read of everything needed to show the menu, price a cart and quote delivery. */
export async function fetchCatalog(): Promise<Catalog> {
  const store = createSupabasePublicClient().schema("store");
  const [categories, brands, products, today, hours, closures, settings, delivery, barangays] = await Promise.all([
    store.from("categories").select("id, name, brand_id, active").order("sort_order"),
    store.from("brands").select("id, name, tagline, notice_days").eq("active", true).order("sort_order"),
    store
      .from("products")
      .select(
        `id, sku, name, description, category_id, type, price_mode, sold_by, price, estimated_price, weight_options_kg,
         prep_minutes, stock_tracked, stock_qty, sold_out, active, image_url, sort_order, notice_days, note_prompt,
         product_ingredients(is_key, ingredients(id, availability_mode, default_wait_minutes)),
         product_modifier_groups(sort_order, show_when_modifier_id, modifier_groups(id, name, required, min_select, max_select,
           modifiers(id, name, price_delta, requires_cooking, active, sort_order)))`,
      )
      .eq("active", true)
      .order("sort_order"),
    store.from("ingredient_availability_today").select("ingredient_id, status"),
    store.from("store_hours").select("day_of_week, opens_at, closes_at, is_open"),
    store.from("store_closures").select("date"),
    store.from("store_settings").select("*").eq("id", true).single(),
    store.from("delivery_settings").select("*").eq("id", true).single(),
    store.from("barangays").select("id, name, center_lat, center_lng, fee_override, surcharge").eq("active", true).order("name"),
  ]);
  for (const r of [categories, brands, products, today, hours, closures, settings, delivery, barangays]) if (r.error) throw r.error;

  const todayStatus = new Map<string, DailyStatus>(
    (today.data ?? []).filter((r) => r.ingredient_id && r.status).map((r) => [r.ingredient_id!, r.status!]),
  );
  const s = settings.data!;
  const d = delivery.data!;

  const activeBrands: CatalogBrand[] = (brands.data ?? []).map((b) => ({ id: b.id, name: b.name, tagline: b.tagline, noticeDays: b.notice_days }));
  const brandById = new Map(activeBrands.map((b) => [b.id, b]));
  // Products of a hidden (inactive) brand can't be ordered; its categories aren't shown.
  const hiddenBrandCategories = new Set((categories.data ?? []).filter((c) => c.brand_id && !brandById.has(c.brand_id)).map((c) => c.id));
  const categoryBrand = new Map((categories.data ?? []).map((c) => [c.id, c.brand_id ? (brandById.get(c.brand_id) ?? null) : null]));

  return {
    categories: (categories.data ?? [])
      .filter((c) => c.active && !hiddenBrandCategories.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, brandId: c.brand_id })),
    brands: activeBrands,
    products: (products.data ?? []).filter((p) => !hiddenBrandCategories.has(p.category_id)).map((p) => {
      const keyIngredients = p.product_ingredients
        .filter((l) => l.is_key && l.ingredients)
        .map((l) => ({
          availabilityMode: l.ingredients!.availability_mode as AvailabilityMode,
          defaultWaitMinutes: l.ingredients!.default_wait_minutes,
          todayStatus: todayStatus.get(l.ingredients!.id),
        }));
      const hasPrice = p.price_mode === "market" ? p.price !== null || p.estimated_price !== null : p.price !== null;
      const brand = categoryBrand.get(p.category_id) ?? null;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        imageUrl: p.image_url,
        categoryId: p.category_id,
        type: p.type,
        priceMode: p.price_mode,
        soldBy: p.sold_by,
        price: p.price,
        estimatedPrice: p.estimated_price,
        weightOptionsKg: p.weight_options_kg,
        prepMinutes: p.prep_minutes,
        brand: brand?.name ?? null,
        noticeDays: p.notice_days ?? brand?.noticeDays ?? 0,
        notePrompt: p.note_prompt,
        badge: menuBadge({
          active: p.active,
          hasPrice,
          soldOut: p.sold_out,
          stockTracked: p.stock_tracked,
          stockQty: p.stock_qty,
          keyIngredients,
        }),
        confirmWaitMinutes: confirmWaitMinutes(keyIngredients),
        groups: [...p.product_modifier_groups]
          .sort((a, b) => a.sort_order - b.sort_order)
          .filter((l) => l.modifier_groups)
          .map((l) => {
            const g = l.modifier_groups!;
            return {
              id: g.id,
              name: g.name,
              required: g.required,
              minSelect: g.min_select,
              maxSelect: g.max_select,
              showWhenModifierId: l.show_when_modifier_id,
              modifiers: [...g.modifiers]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((m) => ({
                  id: m.id,
                  name: m.name,
                  priceDelta: m.price_delta,
                  requiresCooking: m.requires_cooking,
                  active: m.active,
                })),
            };
          }),
      };
    }),
    hours: (hours.data ?? []).map((h) => ({
      dayOfWeek: h.day_of_week,
      opensAt: hhmm(h.opens_at),
      closesAt: hhmm(h.closes_at),
      isOpen: h.is_open,
    })),
    closures: (closures.data ?? []).map((c) => c.date),
    settings: {
      orderingPaused: s.ordering_paused,
      allowPreorders: s.allow_preorders,
      prepLeadMinutes: s.prep_lead_minutes,
      deliveryBufferMinutes: s.delivery_buffer_minutes,
      uncertainItemsCutoff: hhmm(s.uncertain_items_cutoff),
      slotStartOffsetMinutes: s.slot_start_offset_minutes,
      slotEndOffsetMinutes: s.slot_end_offset_minutes,
      customerDecisionMinutes: s.customer_decision_minutes,
      unpaidFlagMinutes: s.unpaid_flag_minutes,
      gcashQrUrl: s.gcash_qr_url,
      gcashAccountName: s.gcash_account_name,
      pickupInstructions: s.pickup_instructions,
    },
    delivery: {
      baseFee: d.base_fee,
      includedKm: d.included_km,
      perKm: d.per_km,
      roundTo: d.round_to,
      minFee: d.min_fee,
      maxKm: d.max_km,
      freeDeliveryThreshold: d.free_delivery_threshold,
      kitchen: d.kitchen_lat !== null && d.kitchen_lng !== null ? { lat: d.kitchen_lat, lng: d.kitchen_lng } : null,
      kitchenAddress: d.kitchen_address,
      serviceArea: (d.service_area_geojson as ServiceAreaGeoJSON | null) ?? null,
      excludedAreas: (d.excluded_areas_geojson as ServiceAreaGeoJSON | null) ?? null,
    },
    barangays: (barangays.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      center: b.center_lat !== null && b.center_lng !== null ? { lat: b.center_lat, lng: b.center_lng } : null,
      feeOverride: b.fee_override,
      surcharge: b.surcharge,
    })),
  };
}

/** Fallback map center (Daanbantayan town proper, approximate) when nothing better is known. */
export const DAANBANTAYAN_CENTER = { lat: 11.25, lng: 124.0 };
