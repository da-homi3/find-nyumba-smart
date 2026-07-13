import { describe, expect, it } from "vitest";
import {
  defaultPricePeriod,
  defaultPricingMode,
  listingPriceAmountLabel,
  listingPriceSuffix,
  listingPricingNote,
  normalizePricingMode,
  pricingModeOptionsForPropertyType,
  supportsRentSaleChoice,
} from "@/lib/property-types";

describe("property pricing modes", () => {
  it("defaults BnB and hotel to booking/night", () => {
    expect(defaultPricingMode("bnb")).toBe("booking");
    expect(defaultPricePeriod("hotel", "booking")).toBe("night");
  });

  it("labels commercial sale without a period suffix", () => {
    expect(
      listingPriceSuffix({
        property_type: "commercial",
        pricing_mode: "sale",
        price_period: null,
      }),
    ).toBe("");
    expect(
      listingPriceAmountLabel({
        property_type: "commercial",
        pricing_mode: "sale",
        price_period: null,
      }),
    ).toBe("Sale price (KES)");
  });

  it("shows booking period for commercial short-term listings", () => {
    expect(
      listingPricingNote({
        property_type: "commercial",
        pricing_mode: "booking",
        price_period: "week",
        minimum_rent_period_months: null,
      }),
    ).toContain("per week");
  });

  it("forces nightly types onto booking pricing", () => {
    expect(normalizePricingMode("bnb", "rent")).toBe("booking");
  });

  it("offers rent and sale for residential types", () => {
    expect(supportsRentSaleChoice("two_bedroom")).toBe(true);
    expect(pricingModeOptionsForPropertyType("two_bedroom").map((m) => m.id)).toEqual([
      "rent",
      "sale",
    ]);
  });

  it("notes for-sale residential listings", () => {
    expect(
      listingPricingNote({
        property_type: "bungalow",
        pricing_mode: "sale",
        price_period: null,
        minimum_rent_period_months: null,
      }),
    ).toContain("for sale");
  });
});
