import { describe, expect, it } from "vitest";
import {
  countListingsByHomepageCategory,
  HOMEPAGE_PROPERTY_CATEGORIES,
} from "@/lib/landing/homepage-categories";
import type { PropertyType } from "@/lib/property-types";

describe("homepage categories", () => {
  it("maps listing types into discovery buckets", () => {
    const counts = countListingsByHomepageCategory([
      { property_type: "bedsitter" as PropertyType },
      { property_type: "two_bedroom" as PropertyType },
      { property_type: "bnb" as PropertyType },
    ]);
    expect(counts.bedsitter).toBe(1);
    expect(counts.two_bedroom).toBe(1);
    expect(counts.airbnb).toBe(1);
  });

  it("defines stable category ids for homepage cards", () => {
    expect(HOMEPAGE_PROPERTY_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(HOMEPAGE_PROPERTY_CATEGORIES.map((c) => c.id)).size).toBe(
      HOMEPAGE_PROPERTY_CATEGORIES.length,
    );
  });
});
