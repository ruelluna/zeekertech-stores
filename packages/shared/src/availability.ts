import type { AvailabilityMode, DailyStatus } from "./enums";

export type MenuBadge =
  /** Orderable now: everything certain, or uncertain ingredients marked available today. */
  | "available"
  /** Orderable, but staff confirm the uncertain ingredients first (customer pays after). */
  | "subject_to_availability"
  /** Not orderable today. */
  | "sold_out"
  /** No price set yet (or inactive): hidden from ordering, shown as "coming soon". */
  | "unavailable";

export interface BadgeIngredient {
  availabilityMode: AvailabilityMode;
  /** Today's status from the daily board; undefined = not set today. */
  todayStatus?: DailyStatus;
}

export interface BadgeProduct {
  active: boolean;
  /** Null until the owner sets a price. Market items need an estimate or per-kg price instead. */
  hasPrice: boolean;
  soldOut: boolean;
  stockTracked: boolean;
  stockQty: number | null;
  keyIngredients: BadgeIngredient[];
}

/** The badge a product shows on the menu (PLAN.md §3.1 and §7). */
export function menuBadge(p: BadgeProduct): MenuBadge {
  if (!p.active || !p.hasPrice) return "unavailable";
  if (p.soldOut) return "sold_out";
  if (p.stockTracked && (p.stockQty ?? 0) <= 0) return "sold_out";

  let uncertain = false;
  for (const i of p.keyIngredients) {
    if (i.todayStatus === "out") return "sold_out";
    if (i.availabilityMode === "subject_to_availability" && i.todayStatus !== "available") uncertain = true;
  }
  return uncertain ? "subject_to_availability" : "available";
}

/** Longest default wait to confirm among a product's unconfirmed uncertain ingredients. */
export function confirmWaitMinutes(
  ingredients: (BadgeIngredient & { defaultWaitMinutes: number | null })[],
): number | null {
  const waits = ingredients
    .filter((i) => i.availabilityMode === "subject_to_availability" && i.todayStatus !== "available")
    .map((i) => i.defaultWaitMinutes)
    .filter((m): m is number => m !== null);
  return waits.length ? Math.max(...waits) : null;
}
