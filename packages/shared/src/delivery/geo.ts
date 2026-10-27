// Minimal GeoJSON point-in-polygon (ray casting), enough for the service-area check.
// GeoJSON positions are [longitude, latitude].

type Ring = number[][];
type PolygonCoords = Ring[];

export type ServiceAreaGeoJSON =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: PolygonCoords[] };

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, polygon: PolygonCoords): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !inRing(lng, lat, outer)) return false;
  return !holes.some((hole) => inRing(lng, lat, hole));
}

export function isInServiceArea(point: { lat: number; lng: number }, area: ServiceAreaGeoJSON): boolean {
  const polygons = area.type === "Polygon" ? [area.coordinates] : area.coordinates;
  return polygons.some((p) => inPolygon(point.lng, point.lat, p));
}

/** Rough center of a service area (average of the outer ring of the first polygon), for map defaults. */
export function serviceAreaCenter(area: ServiceAreaGeoJSON): { lat: number; lng: number } | null {
  const outer = (area.type === "Polygon" ? area.coordinates[0] : area.coordinates[0]?.[0]) ?? [];
  if (outer.length === 0) return null;
  const sum = outer.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng!, lat: acc.lat + lat! }), { lng: 0, lat: 0 });
  return { lat: sum.lat / outer.length, lng: sum.lng / outer.length };
}
