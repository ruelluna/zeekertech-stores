import type { FeeBreakdown } from "../orders";
import type { FeeSource } from "../enums";

export interface DeliverySettings {
  baseFee: number;
  includedKm: number;
  perKm: number;
  /** Round the formula result up to a multiple of this (e.g. 5). */
  roundTo: number;
  minFee: number;
  maxKm: number;
  /** Free delivery when the subtotal reaches this. Null = off. */
  freeDeliveryThreshold: number | null;
}

export interface BarangayFeeRule {
  /** Fixed fee for the barangay; replaces the formula. */
  feeOverride: number | null;
  /** Added on top of the formula result. */
  surcharge: number | null;
}

export type DeliveryFeeResult =
  | { ok: true; fee: number; source: FeeSource; breakdown: FeeBreakdown | null }
  | { ok: false; reason: "invalid_distance" | "too_far" };

/** Confirmed defaults for Weekend Food Hub (PLAN.md §6.2). Editable in the admin. */
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  baseFee: 30,
  includedKm: 2,
  perKm: 10,
  roundTo: 5,
  minFee: 30,
  maxKm: 25,
  freeDeliveryThreshold: null,
};

const toCentavos = (n: number) => Math.round(n * 100) / 100;

export function calculateDeliveryFee(input: {
  settings: DeliverySettings;
  distanceKm: number;
  subtotal: number;
  barangay?: BarangayFeeRule | null;
}): DeliveryFeeResult {
  const { settings: s, distanceKm, subtotal, barangay } = input;

  if (!Number.isFinite(distanceKm) || distanceKm < 0) return { ok: false, reason: "invalid_distance" };
  if (distanceKm > s.maxKm) return { ok: false, reason: "too_far" };

  if (s.freeDeliveryThreshold !== null && subtotal >= s.freeDeliveryThreshold) {
    return { ok: true, fee: 0, source: "free_threshold", breakdown: null };
  }

  if (barangay?.feeOverride != null) {
    return { ok: true, fee: barangay.feeOverride, source: "barangay_override", breakdown: null };
  }

  // Round to centavos first so float noise (74.00000000000001) can't bump a fee to the next ₱5.
  const raw = toCentavos(s.baseFee + s.perKm * Math.max(0, distanceKm - s.includedKm));
  const rounded = Math.ceil(raw / s.roundTo) * s.roundTo;
  const surcharge = barangay?.surcharge ?? 0;
  const fee = Math.max(s.minFee, rounded) + surcharge;

  return {
    ok: true,
    fee,
    source: "formula",
    breakdown: {
      baseFee: s.baseFee,
      includedKm: s.includedKm,
      perKm: s.perKm,
      roundTo: s.roundTo,
      surcharge,
    },
  };
}

/** Fallback when the road-distance service is down: straight line × 1.3, marked as estimated. */
export const STRAIGHT_LINE_ROAD_FACTOR = 1.3;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimateRoadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineKm(a, b) * STRAIGHT_LINE_ROAD_FACTOR;
}

/**
 * What the rider earns for one delivery: a share of the delivery fee charged, never below the minimum.
 * Add-on orders ride along with another delivery, so they earn nothing extra.
 */
export function riderPay(input: { deliveryFee: number; sharePercent: number; minPay: number; addOn?: boolean }): number {
  if (input.addOn) return 0;
  const share = Math.round(input.deliveryFee * input.sharePercent) / 100;
  return Math.max(input.minPay, share);
}
