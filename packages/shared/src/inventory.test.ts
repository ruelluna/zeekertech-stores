import { describe, expect, it } from "vitest";
import { averageDailyUsage, buySuggestion, dailyUsage, type DayCount, type InventoryRule } from "./inventory";

const day = (date: string, beginning: number | null, ending: number | null, received = 0, wasted = 0): DayCount => ({
  date,
  beginning,
  received,
  wasted,
  ending,
});

describe("dailyUsage", () => {
  it("is beginning + received − wasted − ending", () => {
    expect(dailyUsage(day("2026-10-27", 5, 2, 3, 0.5))).toBe(5.5);
  });
  it("needs both counts", () => {
    expect(dailyUsage(day("2026-10-27", 5, null))).toBeNull();
    expect(dailyUsage(day("2026-10-27", null, 2))).toBeNull();
  });
  it("never goes negative (e.g. a miscount)", () => {
    expect(dailyUsage(day("2026-10-27", 2, 5))).toBe(0);
  });
});

describe("averageDailyUsage", () => {
  it("averages the most recent counted days", () => {
    const history = [day("2026-10-25", 10, 6), day("2026-10-26", 6, 3), day("2026-10-27", 3, null), day("2026-10-20", 20, 0)];
    expect(averageDailyUsage(history, 2)).toBe(3.5);
    expect(averageDailyUsage(history)).toBe(9);
  });
  it("is null with no complete days", () => {
    expect(averageDailyUsage([day("2026-10-27", 3, null)])).toBeNull();
  });
});

describe("buySuggestion", () => {
  const rule: InventoryRule = { parLevel: 5, reorderPoint: 2, buyForDays: 1, wholeUnits: false };

  it("alerts at or below the reorder point and tops up to the target", () => {
    expect(buySuggestion(rule, 2, null, "kg")).toEqual({ status: "buy", quantity: 3, reason: "Only 2 kg left (reorder at 2 kg)" });
  });

  it("uses expected usage when it's above the target", () => {
    const r = buySuggestion({ ...rule, buyForDays: 2 }, 3, 4, "kg");
    expect(r.status).toBe("buy");
    expect(r.quantity).toBe(5); // target 8 (4 × 2 days) − 3
    expect(r.reason).toContain("won't last 2 days");
  });

  it("rounds up to half units for kg and whole units for packs", () => {
    expect(buySuggestion({ ...rule, parLevel: 5.2 }, 4, null).quantity).toBe(1.5);
    expect(buySuggestion({ ...rule, parLevel: 10, wholeUnits: true }, 7.5, null).quantity).toBe(3);
  });

  it("is ok when stock covers the target", () => {
    expect(buySuggestion(rule, 6, 3, "kg")).toEqual({ status: "ok", quantity: 0, reason: "6 kg on hand" });
  });

  it("is unknown without a count or any rule", () => {
    expect(buySuggestion(rule, null, null).status).toBe("unknown");
    expect(buySuggestion({ parLevel: null, reorderPoint: null, buyForDays: 1, wholeUnits: true }, 3, null).status).toBe("unknown");
  });

  it("suggests at least one unit when only a reorder point is set", () => {
    expect(buySuggestion({ parLevel: null, reorderPoint: 5, buyForDays: 1, wholeUnits: true }, 4, null).quantity).toBe(1);
  });
});
