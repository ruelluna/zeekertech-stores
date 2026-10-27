import { describe, expect, it } from "vitest";
import { confirmWaitMinutes, menuBadge, type BadgeProduct } from "./availability";

const base: BadgeProduct = {
  active: true,
  hasPrice: true,
  soldOut: false,
  stockTracked: false,
  stockQty: null,
  keyIngredients: [],
};
const shrimp = (todayStatus?: "available" | "out" | "unknown") => ({
  availabilityMode: "subject_to_availability" as const,
  todayStatus,
});
const pork = { availabilityMode: "always" as const };

describe("menuBadge", () => {
  it("is available when every key ingredient is always available", () => {
    expect(menuBadge({ ...base, keyIngredients: [pork] })).toBe("available");
  });

  it("is subject to availability until shrimp is marked available today", () => {
    expect(menuBadge({ ...base, keyIngredients: [shrimp()] })).toBe("subject_to_availability");
    expect(menuBadge({ ...base, keyIngredients: [shrimp("unknown")] })).toBe("subject_to_availability");
    expect(menuBadge({ ...base, keyIngredients: [shrimp("available")] })).toBe("available");
  });

  it("is sold out when any key ingredient is out today", () => {
    expect(menuBadge({ ...base, keyIngredients: [shrimp("available"), shrimp("out")] })).toBe("sold_out");
  });

  it("is sold out when the sold-out toggle is on or frozen stock hits zero", () => {
    expect(menuBadge({ ...base, soldOut: true })).toBe("sold_out");
    expect(menuBadge({ ...base, stockTracked: true, stockQty: 0 })).toBe("sold_out");
    expect(menuBadge({ ...base, stockTracked: true, stockQty: null })).toBe("sold_out");
    expect(menuBadge({ ...base, stockTracked: true, stockQty: 3 })).toBe("available");
  });

  it("is unavailable without a price or when inactive", () => {
    expect(menuBadge({ ...base, hasPrice: false })).toBe("unavailable");
    expect(menuBadge({ ...base, active: false })).toBe("unavailable");
  });
});

describe("confirmWaitMinutes", () => {
  it("returns the longest wait among unconfirmed uncertain ingredients", () => {
    expect(
      confirmWaitMinutes([
        { ...shrimp(), defaultWaitMinutes: 15 },
        { ...shrimp(), defaultWaitMinutes: 20 },
        { ...shrimp("available"), defaultWaitMinutes: 30 },
        { ...pork, defaultWaitMinutes: null },
      ]),
    ).toBe(20);
  });

  it("is null when nothing needs confirming", () => {
    expect(confirmWaitMinutes([{ ...shrimp("available"), defaultWaitMinutes: 15 }])).toBeNull();
  });
});
