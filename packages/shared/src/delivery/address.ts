import { haversineKm } from "./fee";

// Turns a reverse-geocoded address (OpenStreetMap Nominatim's `address` object) into the checkout's fields:
// the store's barangay, a purok/street line and a landmark. OpenStreetMap is patchy in the provinces: the
// barangay is usually there (as village or quarter, sometimes spelled differently, e.g. "Agujo" for
// "Aguho"), roads and puroks often aren't, so every field may come back empty.

export type ReverseAddress = Partial<Record<string, string>>;

export interface AddressBarangay {
  id: string;
  name: string;
  center: { lat: number; lng: number } | null;
}

export interface AddressGuess {
  barangayId: string | null;
  streetPurok: string | null;
  landmark: string | null;
}

/** Keys where Nominatim puts a Philippine barangay, most specific first. */
const BARANGAY_KEYS = ["village", "quarter", "suburb", "city_district", "neighbourhood", "hamlet"];
/** Keys that can hold a purok, sitio or street. */
const PLACE_KEYS = ["hamlet", "neighbourhood", "quarter", "residential", "road"];
/** Named places that make a good "near …" landmark. */
const LANDMARK_KEYS = ["amenity", "shop", "tourism", "building", "leisure", "office", "place_of_worship"];
/** How far the nearest barangay centre may be when no name matches. */
const MAX_CENTER_KM = 2;
/**
 * A pin this close to one of the store's own barangay centres is in that barangay, whatever OpenStreetMap's
 * rough borders say (they put Tapilon's centre in Agujo, for one).
 */
const SURE_CENTER_KM = 0.6;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(barangay|brgy|bgy)\.?\b/g, " ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** Same barangay name, allowing one letter's difference in longer names (spelling variants). */
function sameName(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 5 && editDistance(x, y) <= 1;
}

/**
 * The store barangay for this address: the store's own barangay centre if the pin is right next to one,
 * else by OpenStreetMap's name, else the nearest barangay centre within 2 km.
 */
export function matchBarangay(address: ReverseAddress, barangays: AddressBarangay[], pin: { lat: number; lng: number }): AddressBarangay | null {
  let nearest: { b: AddressBarangay; km: number } | null = null;
  for (const b of barangays) {
    if (!b.center) continue;
    const km = haversineKm(pin, b.center);
    if (!nearest || km < nearest.km) nearest = { b, km };
  }
  if (nearest && nearest.km <= SURE_CENTER_KM) return nearest.b;

  for (const key of BARANGAY_KEYS) {
    const value = address[key];
    if (!value) continue;
    const match = barangays.find((b) => sameName(b.name, value));
    if (match) return match;
  }
  return nearest && nearest.km <= MAX_CENTER_KM ? nearest.b : null;
}

/** All three checkout fields from one reverse-geocoded address. */
export function guessAddress(address: ReverseAddress, barangays: AddressBarangay[], pin: { lat: number; lng: number }): AddressGuess {
  const barangay = matchBarangay(address, barangays, pin);
  const notBarangay = (v: string | undefined): v is string =>
    !!v && !barangays.some((b) => sameName(b.name, v)) && normalize(v) !== normalize(address.town ?? address.city ?? "");

  const places = PLACE_KEYS.map((k) => address[k]).filter(notBarangay);
  const purok = places.find((v) => /\b(purok|sitio|zone)\b/i.test(v));
  const road = address.road && notBarangay(address.road) ? address.road : undefined;
  const streetPurok = [purok, road].filter((v, i, all): v is string => !!v && all.indexOf(v) === i).join(", ") || places[0] || null;

  const landmarkName = LANDMARK_KEYS.map((k) => address[k]).find(notBarangay);

  return {
    barangayId: barangay?.id ?? null,
    streetPurok,
    landmark: landmarkName ? `near ${landmarkName}` : null,
  };
}
