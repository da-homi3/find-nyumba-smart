import { describe, expect, it } from "vitest";
import { searchKenyaLocations } from "@/lib/geo/location-search";

describe("searchKenyaLocations", () => {
  it("finds Nairobi estates by partial name", () => {
    const results = searchKenyaLocations("kili");
    expect(results.some((r) => r.label === "Kilimani")).toBe(true);
  });

  it("finds locations by county", () => {
    const results = searchKenyaLocations("mombasa");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.subtitle === "Mombasa")).toBe(true);
  });

  it("returns neighborhood storage value for Kenya catalog hits", () => {
    const results = searchKenyaLocations("Westlands");
    const westlands = results.find((r) => r.label === "Westlands");
    expect(westlands?.neighborhood).toBe("Westlands");
    expect(westlands?.source).toBe("kenya");
  });
});
