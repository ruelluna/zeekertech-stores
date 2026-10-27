import { describe, expect, it } from "vitest";
import { isInServiceArea, serviceAreaCenter, type ServiceAreaGeoJSON } from "./geo";

// A 10×10 square with a 2×2 hole, plus a separate "island" square.
const square: number[][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole: number[][] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
const island: number[][] = [[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]];

describe("isInServiceArea", () => {
  const polygon: ServiceAreaGeoJSON = { type: "Polygon", coordinates: [square, hole] };

  it("accepts points inside and rejects points outside or in holes", () => {
    expect(isInServiceArea({ lng: 1, lat: 1 }, polygon)).toBe(true);
    expect(isInServiceArea({ lng: 11, lat: 1 }, polygon)).toBe(false);
    expect(isInServiceArea({ lng: 5, lat: 5 }, polygon)).toBe(false);
  });

  it("checks every polygon of a MultiPolygon", () => {
    const multi: ServiceAreaGeoJSON = { type: "MultiPolygon", coordinates: [[square], [island]] };
    expect(isInServiceArea({ lng: 21, lat: 21 }, multi)).toBe(true);
    expect(isInServiceArea({ lng: 15, lat: 15 }, multi)).toBe(false);
  });

  it("finds a rough center", () => {
    expect(serviceAreaCenter({ type: "Polygon", coordinates: [square] })).toEqual({ lng: 4, lat: 4 });
  });
});
