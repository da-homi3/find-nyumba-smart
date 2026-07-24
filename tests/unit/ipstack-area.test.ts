import { describe, expect, it } from "vitest";
import { buildKenyaAreaHint, mapIpstackToKenyaArea, type IpstackLookup } from "@/lib/apilayer/ipstack";

function lookup(partial: Partial<IpstackLookup>): IpstackLookup {
  return {
    configured: true,
    available: true,
    ip: "1.2.3.4",
    countryCode: "KE",
    countryName: "Kenya",
    regionName: "Nairobi City",
    city: "Nairobi",
    latitude: -1.28,
    longitude: 36.82,
    isProxy: false,
    isTor: false,
    ...partial,
  };
}

describe("ipstack Kenya area mapping", () => {
  it("maps Nairobi city to a catalog neighborhood/county", () => {
    const mapped = mapIpstackToKenyaArea(lookup({ city: "Kilimani", regionName: "Nairobi" }));
    expect(mapped.county).toBe("Nairobi");
    expect(mapped.neighborhood?.toLowerCase()).toContain("kilimani");
    expect(mapped.filterValue?.toLowerCase()).toContain("kilimani");
  });

  it("maps county-only region names to All {County}", () => {
    const mapped = mapIpstackToKenyaArea(lookup({ city: null, regionName: "Kiambu" }));
    expect(mapped.county).toBe("Kiambu");
    expect(mapped.filterValue).toBe("All Kiambu");
  });

  it("marks proxy/tor as elevated fraud risk without blocking", () => {
    const hint = buildKenyaAreaHint(lookup({ isProxy: true, countryCode: "US", city: "New York" }));
    expect(hint.fraudRisk).toBe("elevated");
    expect(hint.countryMismatchLikely).toBe(true);
    expect(hint.county).toBeNull();
  });
});
