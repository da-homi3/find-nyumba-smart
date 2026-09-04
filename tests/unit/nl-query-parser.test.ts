import { describe, expect, it } from "vitest";
import { parseNlSearchQuery } from "@/lib/search/nl-query-parser";

describe("parseNlSearchQuery", () => {
  it("parses bedroom, area, and max rent from a natural sentence", () => {
    const parsed = parseNlSearchQuery("2 bedroom apartment in Kilimani under 60k with parking");
    expect(parsed.filters.propertyType).toBe("two_bedroom");
    expect(parsed.filters.neighborhood).toBe("Kilimani");
    expect(parsed.filters.maxRent).toBe(60_000);
    expect(parsed.hints).toEqual(
      expect.arrayContaining(["2 bedroom", "Under KES 60,000", "Kilimani", "Parking"]),
    );
    expect(parsed.remainingQuery).toBeUndefined();
  });

  it("parses bedsitter and min rent", () => {
    const parsed = parseNlSearchQuery("bedsitter in Westlands from 15k");
    expect(parsed.filters.propertyType).toBe("bedsitter");
    expect(parsed.filters.neighborhood).toBe("Westlands");
    expect(parsed.filters.minRent).toBe(15_000);
  });

  it("parses verified and sale intent", () => {
    const parsed = parseNlSearchQuery("verified villa in Karen for sale");
    expect(parsed.filters.verifiedOnly).toBe(true);
    expect(parsed.filters.propertyType).toBe("villa");
    expect(parsed.filters.pricingMode).toBe("sale");
    expect(parsed.filters.neighborhood).toBe("Karen");
  });

  it("returns empty hints for blank input", () => {
    expect(parseNlSearchQuery("  ").hints).toEqual([]);
  });
});
