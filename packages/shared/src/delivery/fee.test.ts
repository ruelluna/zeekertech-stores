import { describe, expect, it } from "vitest";
import { calculateDeliveryFee, DEFAULT_DELIVERY_SETTINGS as settings, riderPay } from "./fee";

const fee = (distanceKm: number, extra: Partial<Parameters<typeof calculateDeliveryFee>[0]> = {}) =>
  calculateDeliveryFee({ settings, distanceKm, subtotal: 300, ...extra });

describe("calculateDeliveryFee", () => {
  it.each([
    [0, 30],
    [1.2, 30],
    [2, 30],
    [4.1, 55], // 30 + 21 = 51 → 55
    [6.4, 75], // 30 + 44 = 74 → 75 (PLAN.md example)
    [12.8, 140], // 30 + 108 = 138 → 140
    [25, 260],
  ])("%s km → ₱%s", (km, expected) => {
    expect(fee(km)).toMatchObject({ ok: true, fee: expected, source: "formula" });
  });

  it("does not bump an exact multiple of ₱5 because of float noise", () => {
    expect(fee(4.5)).toMatchObject({ ok: true, fee: 55 });
    expect(fee(2.3)).toMatchObject({ ok: true, fee: 35 });
  });

  it("blocks distances beyond the max", () => {
    expect(fee(25.1)).toEqual({ ok: false, reason: "too_far" });
  });

  it("rejects invalid distances", () => {
    expect(fee(-1)).toEqual({ ok: false, reason: "invalid_distance" });
    expect(fee(Number.NaN)).toEqual({ ok: false, reason: "invalid_distance" });
  });

  it("uses a barangay fixed fee instead of the formula", () => {
    expect(fee(12.8, { barangay: { feeOverride: 100, surcharge: null } })).toMatchObject({
      ok: true,
      fee: 100,
      source: "barangay_override",
    });
  });

  it("adds a barangay surcharge after rounding", () => {
    expect(fee(6.4, { barangay: { feeOverride: null, surcharge: 20 } })).toMatchObject({ ok: true, fee: 95 });
  });

  it("is free above the threshold when enabled", () => {
    const withFree = { ...settings, freeDeliveryThreshold: 1000 };
    expect(fee(6.4, { settings: withFree, subtotal: 1000 })).toMatchObject({ ok: true, fee: 0, source: "free_threshold" });
    expect(fee(6.4, { settings: withFree, subtotal: 999 })).toMatchObject({ ok: true, fee: 75 });
  });
});

describe("riderPay", () => {
  it("gives the rider their share of the fee (70% by default)", () => {
    expect(riderPay({ deliveryFee: 75, sharePercent: 70, minPay: 0 })).toBe(52.5);
    expect(riderPay({ deliveryFee: 30, sharePercent: 80, minPay: 0 })).toBe(24);
  });

  it("never pays below the minimum, even when the fee was waived", () => {
    expect(riderPay({ deliveryFee: 30, sharePercent: 70, minPay: 25 })).toBe(25);
    expect(riderPay({ deliveryFee: 0, sharePercent: 70, minPay: 20 })).toBe(20);
  });

  it("pays nothing extra for an add-on to another delivery", () => {
    expect(riderPay({ deliveryFee: 0, sharePercent: 70, minPay: 20, addOn: true })).toBe(0);
  });
});
