import { describe, expect, it } from "vitest";
import {
  createPlaceFocus,
  haversineKm,
  nearbyKenyaLocations,
  placeFocusRadiusKm,
  searchKenyaLocations,
} from "@/lib/geo/location-search";
import { filterPropertiesNearPlace } from "@/components/tenant-map/map-constants";
import type { Property } from "@/lib/properties";

describe("searchKenyaLocations", () => {
  it("finds Nairobi estates by partial name", () => {
    const results = searchKenyaLocations("kili");
    expect(results.some((r) => r.label === "Kilimani")).toBe(true);
    expect(results.find((r) => r.label === "Kilimani")?.kind).toBe("neighborhood");
  });

  it("finds locations by county", () => {
    const results = searchKenyaLocations("mombasa");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.subtitle?.includes("Mombasa"))).toBe(true);
  });

  it("returns neighborhood storage value for Kenya catalog hits", () => {
    const results = searchKenyaLocations("Westlands");
    const westlands = results.find((r) => r.label === "Westlands");
    expect(westlands?.neighborhood).toBe("Westlands");
    expect(westlands?.source).toBe("kenya");
  });
});

describe("nearbyKenyaLocations", () => {
  it("returns nearby neighborhoods around a point", () => {
    const near = nearbyKenyaLocations(-1.29, 36.78, { limit: 5, maxKm: 10 });
    expect(near.length).toBeGreaterThan(0);
    expect(near[0]?.kind).toBe("neighborhood");
  });
});

describe("place focus helpers", () => {
  it("uses tighter radius for landmarks than areas", () => {
    expect(placeFocusRadiusKm("landmark")).toBeLessThan(placeFocusRadiusKm("area"));
  });

  it("creates place focus from a search result", () => {
    const [westlands] = searchKenyaLocations("Westlands");
    expect(westlands).toBeTruthy();
    const focus = createPlaceFocus(westlands!);
    expect(focus.label).toBe("Westlands");
    expect(focus.radiusKm).toBeGreaterThan(0);
  });

  it("haversine is ~0 for same point", () => {
    expect(haversineKm(-1.3, 36.8, -1.3, 36.8)).toBeLessThan(0.01);
  });

  it("filters listings within radius", () => {
    const properties = [
      {
        id: "a",
        title: "Near",
        neighborhood: "Kilimani",
        property_type: "apartment",
        rent_kes: 50_000,
        latitude: -1.29,
        longitude: 36.78,
        is_active: true,
        images: [],
      },
      {
        id: "b",
        title: "Far",
        neighborhood: "Syokimau",
        property_type: "apartment",
        rent_kes: 40_000,
        latitude: -1.36,
        longitude: 36.94,
        is_active: true,
        images: [],
      },
    ] as unknown as Property[];

    const near = filterPropertiesNearPlace(properties, -1.29, 36.78, 3);
    expect(near.some((p) => p.id === "a")).toBe(true);
    expect(near.some((p) => p.id === "b")).toBe(false);
  });
});
