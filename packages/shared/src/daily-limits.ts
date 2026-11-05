// Per-product daily limits (store.products.daily_limit): the most of a product a store makes for one
// pickup/delivery day. "Booked" counts come from store.booked_qty(), keyed by SKU and Manila date.

/** Booked quantity per SKU per Manila date ("2026-11-07"). */
export type BookedQty = Record<string, Record<string, number>>;

export interface LimitedLine {
  sku: string;
  name: string;
  qty: number;
  /** Null = no limit. */
  dailyLimit: number | null;
}

/** How many more of a product can be booked on a date, or null if it has no limit. */
export function remainingOn(dailyLimit: number | null, booked: BookedQty, sku: string, dateKey: string): number | null {
  if (dailyLimit === null) return null;
  return Math.max(0, dailyLimit - (booked[sku]?.[dateKey] ?? 0));
}

/**
 * Products in the cart that don't fit on this date, with how many are left. Lines for the same product
 * (e.g. different add-ons) are added together.
 */
export function dailyLimitShortfalls(lines: LimitedLine[], booked: BookedQty, dateKey: string): { sku: string; name: string; left: number }[] {
  const wanted = new Map<string, { name: string; qty: number; limit: number }>();
  for (const l of lines) {
    if (l.dailyLimit === null) continue;
    const w = wanted.get(l.sku);
    wanted.set(l.sku, { name: l.name, qty: (w?.qty ?? 0) + l.qty, limit: l.dailyLimit });
  }
  const short: { sku: string; name: string; left: number }[] = [];
  for (const [sku, w] of wanted) {
    const left = remainingOn(w.limit, booked, sku, dateKey)!;
    if (w.qty > left) short.push({ sku, name: w.name, left });
  }
  return short;
}

/** Customer-facing reason a day is full for this cart, e.g. "Only 2 Macaroons left for Sat". */
export function shortfallMessage(short: { name: string; left: number }[], dayLabel: string): string {
  return short.map((s) => (s.left === 0 ? `${s.name} is fully booked for ${dayLabel}` : `Only ${s.left} ${s.name} left for ${dayLabel}`)).join(". ");
}
