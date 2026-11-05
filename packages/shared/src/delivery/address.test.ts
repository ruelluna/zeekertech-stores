import { describe, expect, it } from "vitest";
import { guessAddress, matchBarangay, type AddressBarangay } from "./address";

const barangays: AddressBarangay[] = [
  { id: "aguho", name: "Aguho", center: null },
  { id: "malingin", name: "Malingin", center: { lat: 11.2158951, lng: 124.0163763 } },
  { id: "poblacion", name: "Poblacion", center: { lat: 11.2525775, lng: 124.0022296 } },
  { id: "tapilon", name: "Tapilon", center: { lat: 11.2772313, lng: 124.0314014 } },
];
const town = { town: "Daanbantayan", state: "Cebu", country: "Philippines" };

describe("matchBarangay", () => {
  it("matches OpenStreetMap's village or quarter by name", () => {
    expect(matchBarangay({ ...town, village: "Malingin" }, barangays, { lat: 11.2, lng: 124 })?.id).toBe("malingin");
    expect(matchBarangay({ ...town, quarter: "Poblacion" }, barangays, { lat: 11.2, lng: 124 })?.id).toBe("poblacion");
  });

  it("accepts spelling variants and a Barangay prefix", () => {
    expect(matchBarangay({ ...town, village: "Agujo" }, barangays, { lat: 11.3, lng: 124 })?.id).toBe("aguho");
    expect(matchBarangay({ ...town, village: "Brgy. Tapilon" }, barangays, { lat: 11.3, lng: 124 })?.id).toBe("tapilon");
  });

  it("trusts the store's own barangay centre over OpenStreetMap's border when the pin is next to it", () => {
    // Real lookup: OpenStreetMap puts Tapilon's centre in "Agujo".
    expect(matchBarangay({ ...town, village: "Agujo", quarter: "Poblacion" }, barangays, { lat: 11.2772, lng: 124.0314 })?.id).toBe("tapilon");
  });

  it("falls back to the nearest barangay centre within 2 km", () => {
    expect(matchBarangay(town, barangays, { lat: 11.2775, lng: 124.032 })?.id).toBe("tapilon");
    expect(matchBarangay(town, barangays, { lat: 11.4, lng: 124.2 })).toBeNull();
  });
});

describe("guessAddress", () => {
  it("fills purok, road and a landmark", () => {
    const guess = guessAddress(
      { ...town, village: "Tapilon", hamlet: "Purok Molmol", road: "Daanbantayan–Maya Road", amenity: "Tapilon Elementary School" },
      barangays,
      { lat: 11.277, lng: 124.031 },
    );
    expect(guess).toEqual({ barangayId: "tapilon", streetPurok: "Purok Molmol, Daanbantayan–Maya Road", landmark: "near Tapilon Elementary School" });
  });

  it("leaves fields empty when OpenStreetMap has nothing for them", () => {
    expect(guessAddress({ ...town, village: "Malingin" }, barangays, { lat: 11.21, lng: 124.01 })).toEqual({
      barangayId: "malingin",
      streetPurok: null,
      landmark: null,
    });
  });

  it("never uses the barangay or town name as the street", () => {
    expect(guessAddress({ ...town, quarter: "Poblacion", neighbourhood: "Poblacion" }, barangays, { lat: 11.25, lng: 124 }).streetPurok).toBeNull();
  });
});
