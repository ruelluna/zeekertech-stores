import { describe, expect, it } from "vitest";
import { calculateDiscount, priceCart, priceLine, type CartLine, type PricingProduct } from "./pricing";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const silog: PricingProduct = {
  id: id(1),
  sku: "SLG-TAPA",
  name: "Tapsilog",
  type: "made_to_order",
  priceMode: "fixed",
  soldBy: "unit",
  price: 120,
  estimatedPrice: null,
  weightOptionsKg: [],
  prepMinutes: 15,
  badge: "available",
  brand: null,
  noticeDays: 0,
  groups: [
    {
      id: id(10),
      name: "Egg style",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        { id: id(11), name: "Sunny side up", priceDelta: 0, requiresCooking: false, active: true },
        { id: id(12), name: "Scrambled", priceDelta: 0, requiresCooking: false, active: true },
      ],
    },
    {
      id: id(20),
      name: "Extras",
      required: false,
      minSelect: 0,
      maxSelect: 2,
      modifiers: [
        { id: id(21), name: "Extra rice", priceDelta: 20, requiresCooking: false, active: true },
        { id: id(22), name: "Extra egg", priceDelta: null, requiresCooking: false, active: true },
      ],
    },
  ],
};

const crab: PricingProduct = {
  ...silog,
  id: id(2),
  sku: "PLT-BPCRAB",
  name: "Black Pepper Crab",
  priceMode: "market",
  soldBy: "weight",
  price: null,
  estimatedPrice: 600,
  weightOptionsKg: [0.5, 1, 1.5],
  prepMinutes: 40,
  badge: "subject_to_availability",
  groups: [],
};

const lumpia: PricingProduct = {
  ...silog,
  id: id(3),
  sku: "FRZ-LUMPIA",
  name: "Vegetable Lumpia",
  type: "frozen",
  price: 150,
  prepMinutes: 15,
  groups: [
    {
      id: id(30),
      name: "Preparation",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        { id: id(31), name: "As is", priceDelta: 0, requiresCooking: false, active: true },
        { id: id(32), name: "Fried", priceDelta: 25, requiresCooking: true, active: true },
      ],
    },
  ],
};

const line = (productId: string, extra: Partial<CartLine> = {}): CartLine => ({
  lineId: id(99),
  productId,
  qty: 1,
  weightKg: null,
  modifierIds: [],
  notes: "",
  ...extra,
});

describe("priceLine", () => {
  it("prices a fixed item with options", () => {
    const r = priceLine(silog, line(silog.id, { qty: 2, modifierIds: [id(11), id(21)] }));
    expect(r.ok && r.line.item).toMatchObject({ unitPrice: 140, estimatedUnitPrice: null, needsAvailability: false });
    expect(r.ok && r.line.item.modifiers.map((m) => m.option)).toEqual(["Sunny side up", "Extra rice"]);
    expect(r.ok && r.line.prepMinutes).toBe(15);
  });

  it("requires required groups and rejects unpriced or foreign options", () => {
    expect(priceLine(silog, line(silog.id))).toEqual({ ok: false, error: "Choose egg style for Tapsilog" });
    expect(priceLine(silog, line(silog.id, { modifierIds: [id(11), id(22)] }))).toEqual({
      ok: false,
      error: "Extra egg isn't available right now",
    });
    expect(priceLine(silog, line(silog.id, { modifierIds: [id(11), id(31)] })).ok).toBe(false);
    expect(priceLine(silog, line(silog.id, { modifierIds: [id(11), id(12)] })).ok).toBe(false);
  });

  it("estimates market items by weight and flags them for confirmation", () => {
    const r = priceLine(crab, line(crab.id, { weightKg: 1.5 }));
    expect(r.ok && r.line.item).toMatchObject({ unitPrice: null, estimatedUnitPrice: 900, weightKg: 1.5, needsAvailability: true });
    expect(priceLine(crab, line(crab.id, { weightKg: 2 })).ok).toBe(false);
    expect(priceLine(crab, line(crab.id)).ok).toBe(false);
  });

  it("uses today's per-kg price over the estimate", () => {
    const r = priceLine({ ...crab, price: 700 }, line(crab.id, { weightKg: 1 }));
    expect(r.ok && r.line.item.estimatedUnitPrice).toBe(700);
  });

  it("sends frozen packs to the kitchen only when cooked", () => {
    const asIs = priceLine(lumpia, line(lumpia.id, { modifierIds: [id(31)] }));
    const fried = priceLine(lumpia, line(lumpia.id, { modifierIds: [id(32)] }));
    expect(asIs.ok && [asIs.line.requiresCooking, asIs.line.prepMinutes, asIs.line.item.unitPrice]).toEqual([false, 0, 150]);
    expect(fried.ok && [fried.line.requiresCooking, fried.line.prepMinutes, fried.line.item.unitPrice]).toEqual([true, 15, 175]);
  });

  it("refuses sold-out and unpriced products", () => {
    expect(priceLine({ ...silog, badge: "sold_out" }, line(silog.id, { modifierIds: [id(11)] })).ok).toBe(false);
    expect(priceLine({ ...silog, badge: "unavailable" }, line(silog.id, { modifierIds: [id(11)] })).ok).toBe(false);
  });
});

describe("conditional groups (Egg style only with Add egg)", () => {
  const chaofan: PricingProduct = {
    ...silog,
    id: id(4),
    sku: "CHF-SIOMAI",
    name: "Siomai Chaofan",
    price: 89,
    groups: [
      {
        id: id(40),
        name: "Add-ons",
        required: false,
        minSelect: 0,
        maxSelect: 2,
        modifiers: [{ id: id(41), name: "Add egg", priceDelta: 15, requiresCooking: false, active: true }],
      },
      { ...silog.groups[0]!, showWhenModifierId: id(41) },
    ],
  };

  it("doesn't ask for egg style without an egg", () => {
    const r = priceLine(chaofan, line(chaofan.id));
    expect(r.ok && r.line.item.unitPrice).toBe(89);
  });

  it("requires egg style once Add egg is picked", () => {
    expect(priceLine(chaofan, line(chaofan.id, { modifierIds: [id(41)] }))).toEqual({
      ok: false,
      error: "Choose egg style for Siomai Chaofan",
    });
    const r = priceLine(chaofan, line(chaofan.id, { modifierIds: [id(41), id(12)] }));
    expect(r.ok && [r.line.item.unitPrice, r.line.item.modifiers.map((m) => m.option)]).toEqual([104, ["Add egg", "Scrambled"]]);
  });

  it("drops an egg style picked without the egg", () => {
    const r = priceLine(chaofan, line(chaofan.id, { modifierIds: [id(12)] }));
    expect(r.ok && r.line.item.modifiers).toEqual([]);
  });
});

describe("priceCart", () => {
  const products = new Map([silog, crab, lumpia].map((p) => [p.id, p]));

  it("totals lines, marks estimates and takes the slowest prep time", () => {
    const r = priceCart(products, [
      line(silog.id, { modifierIds: [id(11)] }),
      { ...line(crab.id, { weightKg: 1 }), lineId: id(98) },
    ]);
    expect(r).toMatchObject({ ok: true, subtotal: 720, isEstimate: true, needsAvailability: true, prepMinutes: 40 });
  });

  it("collects errors for every bad line", () => {
    const r = priceCart(products, [line(silog.id), line(id(404))]);
    expect(r.ok === false && r.errors).toHaveLength(2);
  });

  it("rejects an empty cart", () => {
    expect(priceCart(products, [])).toEqual({ ok: false, errors: ["Your cart is empty"] });
  });
});

describe("calculateDiscount", () => {
  it("applies fixed and percent discounts with a minimum and cap", () => {
    expect(calculateDiscount({ type: "fixed", value: 50, maxDiscount: null, minOrder: 300 }, 299)).toBe(0);
    expect(calculateDiscount({ type: "fixed", value: 50, maxDiscount: null, minOrder: 300 }, 300)).toBe(50);
    expect(calculateDiscount({ type: "percent", value: 10, maxDiscount: 100, minOrder: null }, 1500)).toBe(100);
    expect(calculateDiscount({ type: "percent", value: 10, maxDiscount: null, minOrder: null }, 455)).toBe(45.5);
    expect(calculateDiscount({ type: "fixed", value: 50, maxDiscount: null, minOrder: null }, 30)).toBe(30);
  });
});

describe("made-to-order sub-brand items", () => {
  const cake: PricingProduct = {
    ...silog,
    id: id(5),
    sku: "STY-UBE",
    name: "Ube Cake",
    price: 650,
    groups: [],
    brand: "Sweet Treats by Yang",
    noticeDays: 2,
  };

  it("carries the brand onto the order item and the longest notice onto the cart", () => {
    const result = priceCart(
      new Map([
        [cake.id, cake],
        [silog.id, silog],
      ]),
      [line(cake.id, { notes: "Happy birthday Ana" }), line(silog.id, { modifierIds: [id(11)] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0]!.item.brand).toBe("Sweet Treats by Yang");
    expect(result.lines[0]!.item.notes).toBe("Happy birthday Ana");
    expect(result.lines[1]!.item.brand).toBeNull();
    expect(result.noticeDays).toBe(2);
  });
});
