// Daily inventory math: usage from beginning/ending counts, and what to buy next.

export interface DayCount {
  date: string;
  beginning: number | null;
  received: number;
  wasted: number;
  ending: number | null;
}

export interface InventoryRule {
  /** Stock to have at the start of a day. */
  parLevel: number | null;
  /** Alert when the ending count is at or below this. */
  reorderPoint: number | null;
  /** Days one purchase should cover. */
  buyForDays: number;
  /** Round suggestions up to whole units (pcs, packs) instead of half units (kg, liters). */
  wholeUnits: boolean;
}

/** What was used (sold, cooked) in a day: beginning + received − wasted − ending. */
export function dailyUsage(c: DayCount): number | null {
  if (c.beginning === null || c.ending === null) return null;
  return Math.max(0, round2(c.beginning + c.received - c.wasted - c.ending));
}

/** Average usage over the most recent `days` fully counted days (null if none). */
export function averageDailyUsage(history: DayCount[], days = 7): number | null {
  const usages = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(dailyUsage)
    .filter((u): u is number => u !== null)
    .slice(0, days);
  return usages.length ? round2(usages.reduce((s, u) => s + u, 0) / usages.length) : null;
}

export type BuyStatus = "buy" | "ok" | "unknown";

export interface BuySuggestion {
  status: BuyStatus;
  /** How much to buy (0 when status isn't "buy"). */
  quantity: number;
  reason: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Whether to buy an item and how much, from the latest ending count. The target is the larger of the
 * par level and expected usage for `buyForDays` days.
 */
export function buySuggestion(rule: InventoryRule, latestEnding: number | null, avgUsage: number | null, unit = ""): BuySuggestion {
  if (latestEnding === null) return { status: "unknown", quantity: 0, reason: "No ending count yet" };

  const fmt = (n: number) => `${round2(n)}${unit ? ` ${unit}` : ""}`;
  const expected = avgUsage !== null ? avgUsage * rule.buyForDays : null;
  const target = Math.max(rule.parLevel ?? 0, expected ?? 0);

  let reason: string | null = null;
  if (rule.reorderPoint !== null && latestEnding <= rule.reorderPoint) {
    reason = `Only ${fmt(latestEnding)} left (reorder at ${fmt(rule.reorderPoint)})`;
  } else if (expected !== null && latestEnding < expected) {
    reason = `Uses about ${fmt(avgUsage!)} a day; ${fmt(latestEnding)} won't last ${rule.buyForDays === 1 ? "a day" : `${rule.buyForDays} days`}`;
  } else if (rule.parLevel !== null && latestEnding < rule.parLevel) {
    reason = `Below the target of ${fmt(rule.parLevel)}`;
  }

  if (!reason) {
    const configured = rule.parLevel !== null || rule.reorderPoint !== null || avgUsage !== null;
    return configured
      ? { status: "ok", quantity: 0, reason: `${fmt(latestEnding)} on hand` }
      : { status: "unknown", quantity: 0, reason: "Set a target or reorder point" };
  }

  const need = Math.max(target - latestEnding, 0);
  const step = rule.wholeUnits ? 1 : 0.5;
  // A reorder-point alert with no target set still suggests at least one step.
  const quantity = Math.max(step, Math.ceil(need / step) * step);
  return { status: "buy", quantity: round2(quantity), reason };
}

/** Units counted in whole numbers. */
export const WHOLE_UNITS = new Set(["pcs", "pc", "piece", "pieces", "pack", "packs", "box", "boxes", "tray", "trays", "bottle", "bottles", "can", "cans"]);
