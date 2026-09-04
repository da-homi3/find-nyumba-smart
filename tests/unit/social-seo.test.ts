import { describe, expect, it } from "vitest";
import {
  build30DayContentCalendarSeed,
  buildLocationGuidePackage,
  buildPropertySocialPackage,
} from "@/lib/social/content-engine";
import { buildLocationKeywordMatrix, locationKeyword } from "@/lib/social/keywords";
import {
  OFFICIAL_SOCIAL_URLS,
  SOCIAL_BIO_TEMPLATE,
  SOCIAL_DISPLAY_NAME,
  getConfiguredSocialProfiles,
  getTwitterSiteHandle,
  normalizeSocialUrl,
} from "@/lib/social/profiles";

describe("social content engine", () => {
  it("builds property social package with deep link", () => {
    const pkg = buildPropertySocialPackage({
      title: "Modern 2 Bed in Kilimani",
      propertyType: "two_bedroom",
      neighborhood: "Kilimani",
      bedrooms: 2,
      rentKes: 85000,
      propertyId: "11111111-1111-4111-8111-111111111111",
      isVerified: true,
      amenities: ["Parking", "Gym"],
    });
    expect(pkg.searchKeyword).toContain("Kilimani");
    expect(pkg.destinationUrl).toContain("/tenant/property/");
    expect(pkg.destinationUrl).toContain("utm_");
    expect(pkg.caption).toContain("NyumbaSearch");
    expect(pkg.hashtags).toContain("#NyumbaSearch");
    expect(pkg.videoTitle).toContain("Kilimani");
  });

  it("builds location guide linking to area page", () => {
    const pkg = buildLocationGuidePackage({
      areaName: "Westlands",
      slug: "westlands",
    });
    expect(pkg.destinationUrl).toContain("/areas/westlands");
    expect(pkg.hook).toContain("Westlands");
  });

  it("generates 30-day calendar seed", () => {
    const cal = build30DayContentCalendarSeed();
    expect(cal).toHaveLength(30);
    expect(cal[0]?.pillar).toBeTruthy();
    expect(cal[0]?.targetKeyword).toBeTruthy();
  });
});

describe("social keywords", () => {
  it("combines property type and location", () => {
    expect(locationKeyword("2 bedroom", "Karen")).toBe("2 bedroom for rent in Karen");
  });

  it("caps location keyword matrix", () => {
    const matrix = buildLocationKeywordMatrix({ max: 10 });
    expect(matrix.length).toBeLessThanOrEqual(10);
    expect(matrix[0]?.slug).toBeTruthy();
  });
});

describe("social profiles", () => {
  it("exposes brand templates for profile setup", () => {
    expect(SOCIAL_DISPLAY_NAME).toContain("NyumbaSearch");
    expect(SOCIAL_BIO_TEMPLATE).toContain("nyumbasearch.com");
  });

  it("returns official profiles by default", () => {
    const profiles = getConfiguredSocialProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(6);
    expect(profiles.some((p) => p.platform === "instagram")).toBe(true);
    expect(profiles.find((p) => p.platform === "x")?.url).toContain("nyumbasearch");
    expect(getTwitterSiteHandle()).toBe("NyumbaSearch");
  });

  it("strips tracking params from social URLs", () => {
    expect(normalizeSocialUrl("https://x.com/nyumbasearch?s=11")).toBe(
      "https://x.com/nyumbasearch",
    );
    expect(
      normalizeSocialUrl("https://www.instagram.com/nyumbasearch_?igsi=abc&utm_source=qr"),
    ).toBe("https://www.instagram.com/nyumbasearch_");
    expect(OFFICIAL_SOCIAL_URLS.youtube).toContain("@nyumbasearch");
  });
});
