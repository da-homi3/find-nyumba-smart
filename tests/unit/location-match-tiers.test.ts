import { describe, expect, it } from "vitest";
import { classifyLocationMatch, compareByLocationTier, tierRank } from "@/lib/locations/match-tiers";

describe("location match tiers", () => {
  it("ranks inside > near > marketed_as > none", () => {
    expect(tierRank("inside")).toBeGreaterThan(tierRank("near"));
    expect(tierRank("near")).toBeGreaterThan(tierRank("marketed_as"));
    expect(tierRank("marketed_as")).toBeGreaterThan(tierRank("none"));
  });

  it("classifies FK match as inside and text-only as marketed_as", () => {
    const filterId = "11111111-1111-4111-8111-111111111111";
    expect(
      classifyLocationMatch({
        filterLocationId: filterId,
        property: { location_id: filterId, neighborhood: "Kilimani" },
      }),
    ).toBe("inside");

    expect(
      classifyLocationMatch({
        filterLocationId: filterId,
        filterNeighborhood: "Kilimani",
        property: { location_id: null, neighborhood: "Kilimani, Nairobi" },
      }),
    ).toBe("marketed_as");
  });

  it("classifies nearby pins as near", () => {
    expect(
      classifyLocationMatch({
        filterNeighborhood: "Westlands",
        filterLat: -1.267,
        filterLng: 36.81,
        nearKm: 5,
        property: {
          neighborhood: "Parklands",
          latitude: -1.26,
          longitude: 36.82,
        },
      }),
    ).toBe("near");
  });

  it("sorts by tier then distance", () => {
    const rows = [
      { tier: "near" as const, distanceKm: 1 },
      { tier: "inside" as const, distanceKm: 4 },
      { tier: "marketed_as" as const, distanceKm: 0.2 },
    ];
    rows.sort(compareByLocationTier);
    expect(rows.map((r) => r.tier)).toEqual(["inside", "near", "marketed_as"]);
  });
});
