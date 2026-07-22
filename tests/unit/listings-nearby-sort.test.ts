import { describe, expect, it } from "vitest";
import { sortListingsByProximity } from "@/lib/geo/listings-nearby-sort";
import type { BrowseOrigin } from "@/lib/geo/tenant-browse-origin";

const WESTLANDS: BrowseOrigin = {
  lat: -1.267,
  lng: 36.811,
  source: "geolocation",
  homeNeighborhood: "Westlands",
};

function listing(
  id: string,
  neighborhood: string,
  lat: number,
  lng: number,
  featuredUntil?: string | null,
) {
  return {
    id,
    neighborhood,
    latitude: lat,
    longitude: lng,
    featured_until: featuredUntil ?? null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("sortListingsByProximity", () => {
  it("ranks home neighborhood before nearby then farther areas", () => {
    const items = [
      listing("far", "Nyali, Mombasa", -4.0435, 39.6682),
      listing("near-hood", "Parklands", -1.26, 36.82),
      listing("home", "Westlands", -1.268, 36.812),
    ];

    const sorted = sortListingsByProximity(items, WESTLANDS, Date.parse("2026-06-01"));
    expect(sorted.map((p) => p.id)).toEqual(["home", "near-hood", "far"]);
  });

  it("keeps boosted listings ahead of nearer unboosted ones", () => {
    const boostedUntil = "2099-01-01T00:00:00.000Z";
    const items = [
      listing("home", "Westlands", -1.268, 36.812),
      listing("boosted-far", "Nyali, Mombasa", -4.0435, 39.6682, boostedUntil),
    ];

    const sorted = sortListingsByProximity(items, WESTLANDS, Date.parse("2026-06-01"));
    expect(sorted.map((p) => p.id)).toEqual(["boosted-far", "home"]);
  });

  it("orders listings within the same area by distance", () => {
    const items = [
      listing("farther", "Westlands", -1.275, 36.82),
      listing("closer", "Westlands", -1.2675, 36.8112),
    ];

    const sorted = sortListingsByProximity(items, WESTLANDS, Date.parse("2026-06-01"));
    expect(sorted.map((p) => p.id)).toEqual(["closer", "farther"]);
  });
});
