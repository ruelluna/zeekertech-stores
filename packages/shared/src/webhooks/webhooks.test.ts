import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhook } from "./signing";
import { WebToOpsEvent } from "./events";

const secret = "test-secret";
const now = 1_793_000_000;

describe("webhook signing", () => {
  it("verifies its own signature", async () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = await signWebhook(secret, now, body);
    await expect(
      verifyWebhook({ secret, rawBody: body, timestampHeader: String(now), signatureHeader: signature, nowSeconds: now }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    const signature = await signWebhook(secret, now, "{}");
    await expect(
      verifyWebhook({ secret, rawBody: "{ }", timestampHeader: String(now), signatureHeader: signature, nowSeconds: now }),
    ).resolves.toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects timestamps older than 5 minutes", async () => {
    const signature = await signWebhook(secret, now - 301, "{}");
    await expect(
      verifyWebhook({
        secret,
        rawBody: "{}",
        timestampHeader: String(now - 301),
        signatureHeader: signature,
        nowSeconds: now,
      }),
    ).resolves.toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("rejects missing headers", async () => {
    await expect(
      verifyWebhook({ secret, rawBody: "{}", timestampHeader: null, signatureHeader: null }),
    ).resolves.toEqual({ ok: false, reason: "missing_headers" });
  });
});

describe("order.created payload", () => {
  const order = {
    orderId: "WEB-10293",
    customer: { id: null, name: "Ana Cruz", phone: "09171234567", facebookId: null },
    fulfillment: "delivery",
    scheduledFor: "2026-10-31T18:00:00+08:00",
    address: {
      barangay: "Bagay",
      streetPurok: "Purok 3",
      landmark: "Near the chapel",
      lat: 11.25,
      lng: 124.0,
      riderNotes: "",
    },
    delivery: {
      distanceKm: 6.4,
      distanceMethod: "road",
      travelMinutes: 15,
      fee: 75,
      feeSource: "formula",
      breakdown: { baseFee: 30, includedKm: 2, perKm: 10, roundTo: 5, surcharge: 0 },
    },
    items: [
      {
        lineId: "6f1c2a8e-3b7d-4c5e-9a1f-2d3e4f5a6b7c",
        sku: "PLT-BPCRAB",
        name: "Black Pepper Crab",
        qty: 1,
        priceMode: "market",
        unitPrice: null,
        estimatedUnitPrice: 650,
        weightKg: 1,
        modifiers: [{ group: "Spice level", option: "Spicy", priceDelta: 0, requiresCooking: false }],
        notes: "",
        needsAvailability: true,
      },
    ],
    needsAvailability: true,
    totals: { subtotal: 650, discount: null, deliveryFee: 75, total: 725, isEstimate: true },
    payment: { method: "gcash", status: "not_requested" },
  };
  const event = { eventId: "evt_1", event: "order.created", occurredAt: "2026-10-31T16:00:00+08:00", order };

  it("parses a valid delivery order", () => {
    expect(WebToOpsEvent.safeParse(event).success).toBe(true);
  });

  it("requires an address for delivery orders", () => {
    const bad = { ...event, order: { ...order, address: null } };
    expect(WebToOpsEvent.safeParse(bad).success).toBe(false);
  });
});
