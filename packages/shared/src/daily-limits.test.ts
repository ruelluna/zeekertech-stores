import { describe, expect, it } from "vitest";
import { dailyLimitShortfalls, remainingOn, shortfallMessage, type BookedQty } from "./daily-limits";

const booked: BookedQty = { MACAROONS: { "2026-11-07": 8 }, CHF: { "2026-11-07": 39 } };

describe("remainingOn", () => {
  it("subtracts what's booked that day", () => {
    expect(remainingOn(10, booked, "MACAROONS", "2026-11-07")).toBe(2);
    expect(remainingOn(10, booked, "MACAROONS", "2026-11-08")).toBe(10);
  });
  it("is null without a limit and never negative", () => {
    expect(remainingOn(null, booked, "MACAROONS", "2026-11-07")).toBeNull();
    expect(remainingOn(5, booked, "MACAROONS", "2026-11-07")).toBe(0);
  });
});

describe("dailyLimitShortfalls", () => {
  it("adds up lines of the same product before checking", () => {
    const lines = [
      { sku: "MACAROONS", name: "Macaroons", qty: 1, dailyLimit: 10 },
      { sku: "MACAROONS", name: "Macaroons", qty: 2, dailyLimit: 10 },
    ];
    expect(dailyLimitShortfalls(lines, booked, "2026-11-07")).toEqual([{ sku: "MACAROONS", name: "Macaroons", left: 2 }]);
    expect(dailyLimitShortfalls(lines, booked, "2026-11-08")).toEqual([]);
  });

  it("ignores products without a limit", () => {
    expect(dailyLimitShortfalls([{ sku: "CHF", name: "Chaofan", qty: 50, dailyLimit: null }], booked, "2026-11-07")).toEqual([]);
  });

  it("explains the problem to the customer", () => {
    expect(shortfallMessage([{ name: "Macaroons", left: 2 }], "Sat")).toBe("Only 2 Macaroons left for Sat");
    expect(shortfallMessage([{ name: "Macaroons", left: 0 }], "Sat")).toBe("Macaroons is fully booked for Sat");
  });
});
