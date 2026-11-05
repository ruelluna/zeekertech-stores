import "server-only";
import {
  calculateDeliveryFee,
  estimateRoadKm,
  isInServiceArea,
  type DeliveryQuote,
} from "@wfh/shared";
import type { Catalog } from "./catalog";

export type QuoteResult =
  | { ok: true; quote: DeliveryQuote; estimated: boolean }
  | { ok: false; error: string };

/** Average speed used to estimate travel time when only the distance is known (tricycle/motorbike). */
const FALLBACK_KMH = 25;

/** Road route, "no_route" when the routing service says there is no road (e.g. an island), or null if unknown. */
async function roadRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{ km: number; minutes: number } | "no_route" | null> {
  const key = process.env.OPENROUTESERVICE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // 404 = ORS found no route between the points (no road to the pin).
      return res.status === 404 ? "no_route" : null;
    }
    const data = (await res.json()) as { routes?: { summary?: { distance?: number; duration?: number } }[] };
    const summary = data.routes?.[0]?.summary;
    if (summary?.distance === undefined) return null;
    return { km: summary.distance / 1000, minutes: Math.ceil((summary.duration ?? 0) / 60) };
  } catch {
    return null;
  }
}

/** Service-area check, distance (road, or straight line × 1.3) and fee for a delivery pin. */
export async function quoteDelivery(
  catalog: Catalog,
  input: { lat: number; lng: number; barangayId: string; subtotal: number },
): Promise<QuoteResult> {
  const barangay = catalog.barangays.find((b) => b.id === input.barangayId);
  if (!barangay) return { ok: false, error: "We don't deliver to that barangay right now." };

  const { kitchen, serviceArea, excludedAreas } = catalog.delivery;
  if (!kitchen) return { ok: false, error: "Delivery isn't set up yet. Please choose pickup." };

  const area = catalog.delivery.areaName;
  const outside = area ? `Sorry, we only deliver within ${area}.` : "Sorry, that address is outside our delivery area.";
  if (serviceArea && !isInServiceArea(input, serviceArea)) return { ok: false, error: outside };
  if (excludedAreas && isInServiceArea(input, excludedAreas)) return { ok: false, error: outside };

  const route = await roadRoute(kitchen, input);
  if (route === "no_route") return { ok: false, error: outside };
  const road = route;
  const km = road?.km ?? estimateRoadKm(kitchen, input);
  const minutes = road?.minutes ?? Math.ceil((km / FALLBACK_KMH) * 60);

  const fee = calculateDeliveryFee({
    settings: catalog.delivery,
    distanceKm: km,
    subtotal: input.subtotal,
    barangay: { feeOverride: barangay.feeOverride, surcharge: barangay.surcharge },
  });
  if (!fee.ok) {
    return { ok: false, error: fee.reason === "too_far" ? "That address is too far for delivery." : "Couldn't work out the distance." };
  }

  return {
    ok: true,
    estimated: road === null,
    quote: {
      distanceKm: Math.round(km * 10) / 10,
      distanceMethod: road ? "road" : "straight_line",
      travelMinutes: minutes,
      fee: fee.fee,
      feeSource: fee.source,
      breakdown: fee.breakdown,
    },
  };
}
