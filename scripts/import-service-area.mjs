// Imports delivery-area data from OpenStreetMap (via Nominatim):
//   - Daanbantayan's boundary, if OpenStreetMap has one, keeping only the largest polygon (the
//     mainland) so islands fall outside. Without it, the excluded-areas check (Malapascua) and the
//     maximum distance (Carnaza) still apply;
//   - a center point for each barangay, used to recenter the checkout map.
// Usage: pnpm import:service-area   (reads apps/web/.env.local)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

// Nominatim's usage policy: identify the app and stay under 1 request per second.
const HEADERS = { "User-Agent": "WeekendFoodHub-OrderingApp/1.0 (one-off setup script)", "Accept-Language": "en" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatimAll(params) {
  const qs = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "ph", ...params });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const hits = await res.json();
  await sleep(1100);
  return hits;
}

// Shoelace area of a ring in degrees² (only used to compare polygon sizes).
const ringArea = (ring) =>
  Math.abs(
    ring.reduce((sum, [x1, y1], i) => {
      const [x2, y2] = ring[(i + 1) % ring.length];
      return sum + (x1 * y2 - x2 * y1);
    }, 0) / 2,
  );

function inRing([lng, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const db = createClient(url, secret, { auth: { persistSession: false } }).schema("store");
const { data: settings, error: settingsError } = await db
  .from("delivery_settings")
  .select("kitchen_lat, kitchen_lng, excluded_areas_geojson")
  .eq("id", true)
  .single();
if (settingsError) throw settingsError;
const excluded = settings.excluded_areas_geojson?.coordinates ?? [];
const isExcluded = (point) => excluded.some((polygon) => inRing(point, polygon[0]));

// The first search hit is often the town's center point, so look for the administrative boundary.
const hits = await nominatimAll({ q: "Daanbantayan, Cebu", polygon_geojson: "1", limit: "10" });
const town = hits.find((h) => h.category === "boundary" && ["Polygon", "MultiPolygon"].includes(h.geojson?.type));
let mainland = null;
if (!town) {
  console.log("OpenStreetMap has no Daanbantayan boundary polygon yet: keeping the excluded-areas check only.");
} else {
  const polygons = town.geojson.type === "MultiPolygon" ? town.geojson.coordinates : [town.geojson.coordinates];
  mainland = polygons.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best));
  console.log(`Boundary: ${polygons.length} polygon(s), kept the mainland (${mainland[0].length} points).`);
  if (settings.kitchen_lat != null && !inRing([settings.kitchen_lng, settings.kitchen_lat], mainland[0])) {
    console.error("The kitchen pin is outside the imported boundary. Check the pin; nothing was saved.");
    process.exit(1);
  }
  const { error } = await db
    .from("delivery_settings")
    .update({ service_area_geojson: { type: "Polygon", coordinates: mainland } })
    .eq("id", true);
  if (error) throw error;
}

const { data: barangays, error: bError } = await db.from("barangays").select("id, name").order("name");
if (bError) throw bError;
for (const b of barangays) {
  const [hit] = await nominatimAll({ q: `${b.name}, Daanbantayan, Cebu` });
  if (!hit) {
    console.log(`  ${b.name}: not found (map will center on the kitchen)`);
    continue;
  }
  const point = [Number(hit.lon), Number(hit.lat)];
  const skip = isExcluded(point)
    ? "in an excluded area (island)"
    : mainland && !inRing(point, mainland[0])
      ? "outside the mainland boundary"
      : null;
  if (!skip) {
    const { error } = await db.from("barangays").update({ center_lat: point[1], center_lng: point[0] }).eq("id", b.id);
    if (error) throw error;
  }
  console.log(`  ${b.name}: ${point[1].toFixed(5)}, ${point[0].toFixed(5)}${skip ? ` (${skip}, skipped)` : ""}`);
}
console.log("Done. Data © OpenStreetMap contributors (ODbL).");
