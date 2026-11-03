import { z } from "zod";
import type { MenuBadge } from "./availability";
import type { OrderItem, ModifierSelection } from "./orders";
import type { PriceMode, ProductType, SoldBy } from "./enums";

/** What the browser sends for each cart line. Prices are never trusted from the client. */
export const CartLine = z.object({
  lineId: z.uuid(),
  productId: z.uuid(),
  qty: z.number().int().min(1).max(50),
  weightKg: z.number().positive().nullable(),
  modifierIds: z.array(z.uuid()).max(20),
  notes: z.string().max(200),
});
export type CartLine = z.infer<typeof CartLine>;

export interface PricingModifier {
  id: string;
  name: string;
  /** Null = not priced yet, so not offered. */
  priceDelta: number | null;
  requiresCooking: boolean;
  active: boolean;
}

export interface PricingGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: PricingModifier[];
  /** For this product, the group only applies when this option is picked (e.g. Egg style ← Add egg). */
  showWhenModifierId?: string | null;
}

/** Whether a group applies given the options picked so far. */
export function groupApplies(group: Pick<PricingGroup, "showWhenModifierId">, pickedIds: Iterable<string>): boolean {
  if (!group.showWhenModifierId) return true;
  for (const id of pickedIds) if (id === group.showWhenModifierId) return true;
  return false;
}

export interface PricingProduct {
  id: string;
  sku: string;
  name: string;
  type: ProductType;
  priceMode: PriceMode;
  soldBy: SoldBy;
  /** Fixed price, or today's price per kg for market items sold by weight. */
  price: number | null;
  /** Market items: estimate (per kg when sold by weight). */
  estimatedPrice: number | null;
  weightOptionsKg: number[];
  prepMinutes: number | null;
  badge: MenuBadge;
  groups: PricingGroup[];
  /** Sub-brand name; null for the main menu. */
  brand: string | null;
  /** Calendar days of advance notice (made-to-order cakes etc.); 0 = same day is fine. */
  noticeDays: number;
}

export interface PricedLine {
  item: OrderItem;
  /** Unit price, or the estimate for market items. */
  displayUnitPrice: number;
  requiresCooking: boolean;
  prepMinutes: number;
  noticeDays: number;
}

export type PriceLineResult = { ok: true; line: PricedLine } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Prices one cart line against the current menu, validating options, weight and availability. */
export function priceLine(product: PricingProduct, line: CartLine): PriceLineResult {
  if (product.badge === "unavailable") return { ok: false, error: `${product.name} isn't available to order yet` };
  if (product.badge === "sold_out") return { ok: false, error: `${product.name} is sold out today` };

  // Weight
  if (product.soldBy === "weight") {
    if (line.weightKg === null || !product.weightOptionsKg.includes(line.weightKg)) {
      return { ok: false, error: `Choose a size for ${product.name}` };
    }
  } else if (line.weightKg !== null) {
    return { ok: false, error: `${product.name} isn't sold by weight` };
  }

  // Options: every selected option must belong to one of the product's groups and be priced.
  const selected: ModifierSelection[] = [];
  const remaining = new Set(line.modifierIds);
  for (const group of product.groups) {
    const picks = group.modifiers.filter((m) => remaining.has(m.id));
    for (const m of picks) remaining.delete(m.id);
    // A conditional group that doesn't apply is skipped: its picks are dropped, its minimum ignored.
    if (!groupApplies(group, line.modifierIds)) continue;
    const min = group.required ? Math.max(1, group.minSelect) : group.minSelect;
    if (picks.length < min) return { ok: false, error: `Choose ${group.name.toLowerCase()} for ${product.name}` };
    if (picks.length > group.maxSelect) {
      return { ok: false, error: `Pick at most ${group.maxSelect} for ${group.name.toLowerCase()} (${product.name})` };
    }
    for (const m of picks) {
      if (!m.active || m.priceDelta === null) return { ok: false, error: `${m.name} isn't available right now` };
      selected.push({ group: group.name, option: m.name, priceDelta: m.priceDelta, requiresCooking: m.requiresCooking });
    }
  }
  if (remaining.size > 0) return { ok: false, error: `Some options for ${product.name} are no longer offered` };

  const deltas = selected.reduce((sum, m) => sum + m.priceDelta, 0);
  const weight = product.soldBy === "weight" ? line.weightKg! : 1;

  let unitPrice: number | null;
  let estimatedUnitPrice: number | null;
  if (product.priceMode === "fixed") {
    if (product.price === null) return { ok: false, error: `${product.name} has no price yet` };
    unitPrice = round2(product.price * weight + deltas);
    estimatedUnitPrice = null;
  } else {
    // Market price: final price is confirmed by staff; estimate from today's price, else the estimate.
    const basis = product.price ?? product.estimatedPrice;
    if (basis === null) return { ok: false, error: `${product.name} has no price yet` };
    unitPrice = null;
    estimatedUnitPrice = round2(basis * weight + deltas);
  }

  const requiresCooking =
    product.type === "frozen" ? selected.some((m) => m.requiresCooking) : product.type !== "ready_made";

  return {
    ok: true,
    line: {
      item: {
        lineId: line.lineId,
        sku: product.sku,
        name: product.name,
        qty: line.qty,
        priceMode: product.priceMode,
        unitPrice,
        estimatedUnitPrice,
        weightKg: product.soldBy === "weight" ? line.weightKg : null,
        modifiers: selected,
        notes: line.notes.trim(),
        needsAvailability: product.badge === "subject_to_availability" || product.priceMode === "market",
        requiresCooking,
        prepMinutes: requiresCooking ? (product.prepMinutes ?? 0) : 0,
        brand: product.brand,
      },
      displayUnitPrice: (unitPrice ?? estimatedUnitPrice)!,
      requiresCooking,
      prepMinutes: requiresCooking ? (product.prepMinutes ?? 0) : 0,
      noticeDays: product.noticeDays,
    },
  };
}

export type PriceCartResult =
  | {
      ok: true;
      lines: PricedLine[];
      subtotal: number;
      /** True while any market-price item is unconfirmed. */
      isEstimate: boolean;
      needsAvailability: boolean;
      prepMinutes: number;
      /** Longest advance notice among the items. */
      noticeDays: number;
    }
  | { ok: false; errors: string[] };

export function priceCart(products: Map<string, PricingProduct>, cart: CartLine[]): PriceCartResult {
  if (cart.length === 0) return { ok: false, errors: ["Your cart is empty"] };

  const lines: PricedLine[] = [];
  const errors: string[] = [];
  for (const entry of cart) {
    const product = products.get(entry.productId);
    if (!product) {
      errors.push("An item in your cart is no longer on the menu");
      continue;
    }
    const result = priceLine(product, entry);
    if (result.ok) lines.push(result.line);
    else errors.push(result.error);
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    lines,
    subtotal: round2(lines.reduce((sum, l) => sum + l.displayUnitPrice * l.item.qty, 0)),
    isEstimate: lines.some((l) => l.item.unitPrice === null),
    needsAvailability: lines.some((l) => l.item.needsAvailability),
    prepMinutes: Math.max(0, ...lines.map((l) => l.prepMinutes)),
    noticeDays: Math.max(0, ...lines.map((l) => l.noticeDays)),
  };
}

export interface DiscountRule {
  type: "fixed" | "percent";
  value: number;
  maxDiscount: number | null;
  minOrder: number | null;
}

/** Discount amount for a subtotal (0 below the minimum order). Never more than the subtotal. */
export function calculateDiscount(rule: DiscountRule, subtotal: number): number {
  if (rule.minOrder !== null && subtotal < rule.minOrder) return 0;
  let amount = rule.type === "fixed" ? rule.value : (subtotal * rule.value) / 100;
  if (rule.maxDiscount !== null) amount = Math.min(amount, rule.maxDiscount);
  return round2(Math.min(amount, subtotal));
}
