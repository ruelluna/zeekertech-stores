import "server-only";
import type { ReverseAddress } from "@wfh/shared";

// Reverse geocoding with OpenStreetMap Nominatim (free, no key). Its usage policy asks for an identifying
// User-Agent, at most one request per second, and caching, so requests are queued one second apart and
// answers are cached by pin (rounded to ~10 m). Only the pin is sent.

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "ZeekerTechStores/1.0 (+https://stores.zeeker.tech)";
const MIN_GAP_MS = 1100;
const CACHE_MAX = 500;

const cache = new Map<string, ReverseAddress | null>();
let nextSlot = 0;

/** The address parts OpenStreetMap has for this pin, or null if the lookup failed. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseAddress | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;

  // Queue behind other lookups to stay under one request per second.
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait > 3000) return null; // Too busy: let the customer fill the fields themselves.
  if (wait) await new Promise((r) => setTimeout(r, wait));

  const url = `${ENDPOINT}?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: ReverseAddress };
    const address = json.address ?? null;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, address);
    return address;
  } catch {
    return null;
  }
}
