import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { MenuBadge, StoreHoursDay } from "@wfh/shared";
import { fetchCatalog } from "./catalog";
import { MENU_TAG } from "./menu-tag";

export interface MenuOption {
  id: string;
  name: string;
  priceDelta: number;
  requiresCooking: boolean;
}

export interface MenuGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  /** Only shown (and required) once this option is picked, e.g. Egg style after Add egg. */
  showWhenModifierId: string | null;
  /** Priced, active options only (unpriced ones aren't offered yet). */
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  priceMode: "fixed" | "market";
  soldBy: "unit" | "weight";
  price: number | null;
  estimatedPrice: number | null;
  weightOptionsKg: number[];
  prepMinutes: number | null;
  badge: MenuBadge;
  confirmWaitMinutes: number | null;
  groups: MenuGroup[];
  /** Calendar days of advance notice (made-to-order cakes etc.); 0 = same day. */
  noticeDays: number;
  /** Label for the notes field, e.g. "Message on the cake". */
  notePrompt: string | null;
}

export interface MenuBrand {
  id: string;
  name: string;
  tagline: string | null;
  noticeDays: number;
}

export interface PublicMenu {
  /** Every category with items; brandId null = the main Weekend Food Hub menu. */
  categories: { id: string; name: string; brandId: string | null; items: MenuItem[] }[];
  /** Sub-brands with at least one category on the menu. */
  brands: MenuBrand[];
  hours: StoreHoursDay[];
  closures: string[];
  orderingPaused: boolean;
  allowPreorders: boolean;
  baseDeliveryFee: number;
}

/**
 * Everything the public menu shows, cached until an admin change (updateTag), a staff-app update
 * (revalidateTag from the webhook), or a few minutes pass.
 */
export async function getPublicMenu(): Promise<PublicMenu> {
  "use cache";
  cacheTag(MENU_TAG);
  cacheLife("minutes");

  const catalog = await fetchCatalog();
  const items = catalog.products.map(
    (p): MenuItem & { categoryId: string } => ({
      categoryId: p.categoryId,
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      type: p.type,
      priceMode: p.priceMode,
      soldBy: p.soldBy,
      price: p.price,
      estimatedPrice: p.estimatedPrice,
      weightOptionsKg: p.weightOptionsKg,
      prepMinutes: p.prepMinutes,
      badge: p.badge,
      confirmWaitMinutes: p.confirmWaitMinutes,
      noticeDays: p.noticeDays,
      notePrompt: p.notePrompt,
      groups: p.groups.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        showWhenModifierId: g.showWhenModifierId ?? null,
        options: g.modifiers
          .filter((m) => m.active && m.priceDelta !== null)
          .map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta!, requiresCooking: m.requiresCooking })),
      })),
    }),
  );

  const categories = catalog.categories
    .map((c) => ({ id: c.id, name: c.name, brandId: c.brandId, items: items.filter((i) => i.categoryId === c.id) }))
    .filter((c) => c.items.length > 0);

  return {
    categories,
    brands: catalog.brands.filter((b) => categories.some((c) => c.brandId === b.id)),
    hours: catalog.hours,
    closures: catalog.closures,
    orderingPaused: catalog.settings.orderingPaused,
    allowPreorders: catalog.settings.allowPreorders,
    baseDeliveryFee: catalog.delivery.baseFee,
  };
}
