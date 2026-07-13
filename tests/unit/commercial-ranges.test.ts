import { describe, expect, it } from "vitest";
import {
  formatListingArea,
  formatListingPrice,
  hasCommercialAreaRange,
  hasCommercialPriceRange,
  normalizeCommercialRangeFields,
  validateCommercialRanges,
} from "@/lib/commercial-ranges";

describe("commercial ranges", () => {
  it("formats single commercial price and area", () => {
    const input = {
      property_type: "commercial" as const,
      rent_kes: 120_000,
      pricing_mode: "rent" as const,
      price_period: "month" as const,
      area_sqm: 80,
    };
    expect(formatListingPrice(input)).toBe("KES 120,000/ mo");
    expect(formatListingArea(input)).toBe("80 m²");
    expect(hasCommercialPriceRange(input)).toBe(false);
    expect(hasCommercialAreaRange(input)).toBe(false);
  });

  it("formats commercial price and area ranges", () => {
    const input = {
      property_type: "commercial" as const,
      rent_kes: 50_000,
      rent_kes_max: 90_000,
      area_sqm: 40,
      area_sqm_max: 120,
      pricing_mode: "rent" as const,
      price_period: "month" as const,
    };
    expect(formatListingPrice(input)).toBe("KES 50,000 – 90,000/ mo");
    expect(formatListingArea(input)).toBe("40 – 120 m²");
    expect(hasCommercialPriceRange(input)).toBe(true);
    expect(hasCommercialAreaRange(input)).toBe(true);
  });

  it("normalizes invalid or equal max values to null", () => {
    const normalized = normalizeCommercialRangeFields({
      property_type: "commercial",
      rent_kes: 100_000,
      rent_kes_max: 80_000,
      area_sqm: 200,
      area_sqm_max: 200,
    });
    expect(normalized.rent_kes_max).toBeNull();
    expect(normalized.area_sqm_max).toBeNull();
  });

  it("clears range fields for non-commercial types", () => {
    const normalized = normalizeCommercialRangeFields({
      property_type: "two_bedroom",
      rent_kes: 45_000,
      rent_kes_max: 60_000,
      area_sqm: 70,
      area_sqm_max: 90,
    });
    expect(normalized.rent_kes_max).toBeNull();
    expect(normalized.area_sqm_max).toBeNull();
  });

  it("collects validation issues for invalid ranges", () => {
    const issues: { path: string; message: string }[] = [];
    validateCommercialRanges(
      {
        property_type: "commercial",
        rent_kes: 100_000,
        rent_kes_max: 50_000,
        area_sqm_max: 30,
      },
      (path, message) => issues.push({ path, message }),
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]?.path).toBe("rent_kes_max");
    expect(issues[1]?.path).toBe("area_sqm");
  });
});
