import { z } from "zod";
import { guessAddress } from "@wfh/shared";
import { fetchCatalog } from "@/lib/catalog";
import { reverseGeocode } from "@/lib/reverse-geocode";

const LookupInput = z.object({
  storeId: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Checkout's "Use my location": the store barangay, purok/street and landmark for a pin, from
 * OpenStreetMap. Every field may be null; the customer checks and edits them before ordering.
 */
export async function POST(request: Request) {
  const parsed = LookupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid location" }, { status: 400 });
  const { storeId, lat, lng } = parsed.data;

  const [catalog, address] = await Promise.all([fetchCatalog(storeId), reverseGeocode(lat, lng)]);
  const guess = guessAddress(address ?? {}, catalog.barangays, { lat, lng });
  return Response.json({ ok: true, ...guess, found: address !== null });
}
