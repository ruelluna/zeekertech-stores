import "server-only";
import { averageDailyUsage, buySuggestion, dailyUsage, WHOLE_UNITS, type BuySuggestion, type DayCount } from "@wfh/shared";
import type { createSupabaseServerClient } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface InventoryRow {
  id: string;
  name: string;
  unit: string;
  category: string;
  parLevel: number | null;
  reorderPoint: number | null;
  buyForDays: number;
  active: boolean;
  sortOrder: number;
  notes: string | null;
  /** This date's counts (beginning prefilled from the previous ending when not counted yet). */
  beginning: number | null;
  beginningIsCarried: boolean;
  received: number;
  wasted: number;
  ending: number | null;
  usage: number | null;
  avgUsage: number | null;
  suggestion: BuySuggestion;
}

const addDays = (dateKey: string, days: number) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The inventory sheet for a Manila date, with usage history (last 14 days) and buy suggestions. */
export async function loadInventory(supabase: Supabase, dateKey: string, includeInactive = false): Promise<InventoryRow[]> {
  const ops = supabase.schema("ops");
  let itemsQuery = ops.from("inventory_items").select("*").order("category").order("sort_order").order("name");
  if (!includeInactive) itemsQuery = itemsQuery.eq("active", true);
  const [items, counts] = await Promise.all([
    itemsQuery,
    ops.from("inventory_counts").select("*").gte("date", addDays(dateKey, -14)).lte("date", dateKey),
  ]);
  if (items.error) throw items.error;
  if (counts.error) throw counts.error;

  return items.data.map((item) => {
    const history: DayCount[] = counts.data
      .filter((c) => c.item_id === item.id)
      .map((c) => ({ date: c.date, beginning: c.beginning, received: c.received, wasted: c.wasted, ending: c.ending }));
    const today = history.find((c) => c.date === dateKey);
    const previous = history
      .filter((c) => c.date < dateKey && c.ending !== null)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    const beginning = today?.beginning ?? previous?.ending ?? null;
    const current: DayCount = {
      date: dateKey,
      beginning,
      received: today?.received ?? 0,
      wasted: today?.wasted ?? 0,
      ending: today?.ending ?? null,
    };
    const avgUsage = averageDailyUsage(history.filter((c) => c.date !== dateKey).concat(current.ending !== null ? [current] : []));
    // Before tonight's count, judge from what's expected to be left: start of day plus purchases.
    const latest = current.ending ?? (beginning !== null ? beginning + current.received - current.wasted : null);

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      category: item.category,
      parLevel: item.par_level,
      reorderPoint: item.reorder_point,
      buyForDays: item.buy_for_days,
      active: item.active,
      sortOrder: item.sort_order,
      notes: item.notes,
      beginning,
      beginningIsCarried: today?.beginning == null && previous?.ending != null,
      received: current.received,
      wasted: current.wasted,
      ending: current.ending,
      usage: dailyUsage(current),
      avgUsage,
      suggestion: buySuggestion(
        {
          parLevel: item.par_level,
          reorderPoint: item.reorder_point,
          buyForDays: item.buy_for_days,
          wholeUnits: WHOLE_UNITS.has(item.unit.toLowerCase()),
        },
        latest,
        avgUsage,
        item.unit,
      ),
    };
  });
}
