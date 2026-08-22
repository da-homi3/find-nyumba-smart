import { describe, expect, it } from "vitest";
import {
  countyLookupKey,
  normalizeLocationName,
  parsePlaceQuery,
  slugifyLocationName,
} from "@/lib/locations/normalize";
import { shouldIndexArea, areaFromSlug, areaSlug } from "@/lib/seo/areas";
import { SEO_INVENTORY_THRESHOLD, SEO_WARD_INVENTORY_THRESHOLD } from "@/lib/locations/types";
import { classifyLocationMatch, compareByLocationTier } from "@/lib/locations/match-tiers";
import seedReport from "../../docs/location-seed-report.json";

describe("location normalize", () => {
  it("strips curly apostrophes and maps Nairobi / Murang'a county keys", () => {
    expect(normalizeLocationName("Murang'a")).toBe("muranga");
    expect(normalizeLocationName("Murang’a")).toBe("muranga");
    expect(countyLookupKey("Nairobi")).toBe("nairobi city");
    expect(countyLookupKey("Nairobi City")).toBe("nairobi city");
    expect(countyLookupKey("Murang'a")).toBe("murang a");
    expect(slugifyLocationName("South B")).toBe("south-b");
  });

  it("parses place + county hints for resolve acceptance cases", () => {
    expect(parsePlaceQuery("Kilimani Nairobi")).toEqual({
      place: "Kilimani",
      countyHint: "Nairobi",
      alternates: [],
    });
    expect(parsePlaceQuery("Kangemi, Nairobi")).toEqual({
      place: "Kangemi",
      countyHint: "Nairobi",
      alternates: [],
    });
    expect(parsePlaceQuery("westland").place.toLowerCase()).toBe("westland");
    expect(parsePlaceQuery("Ruaka").countyHint).toBeNull();
    expect(parsePlaceQuery("CBD").place).toBe("CBD");
  });

  it("scrubs landlord noise without inventing places", () => {
    expect(parsePlaceQuery("Gigiri(UN ZONE)")).toEqual({
      place: "Gigiri",
      countyHint: null,
      alternates: [],
    });
    expect(parsePlaceQuery("Kileleshwa, vihiga road")).toEqual({
      place: "Kileleshwa",
      countyHint: null,
      alternates: ["vihiga road"],
    });
    expect(parsePlaceQuery("Along Ngong Road")).toEqual({
      place: "Ngong Road",
      countyHint: null,
      alternates: [],
    });
    expect(parsePlaceQuery("Ngong Road").place).toBe("Ngong Road");
    expect(parsePlaceQuery("Karen near tangaza university")).toEqual({
      place: "Karen",
      countyHint: null,
      alternates: ["tangaza university"],
    });
    expect(parsePlaceQuery("Thindigua along kiambu road").alternates.map((a) => a.toLowerCase())).toContain(
      "kiambu road",
    );
    expect(parsePlaceQuery("87, waiyaki way").place.toLowerCase()).toBe("waiyaki way");
    expect(parsePlaceQuery("Along waiyaki way").place.toLowerCase()).toBe("waiyaki way");
    expect(parsePlaceQuery("Bogani road, karen").alternates.map((a) => a.toLowerCase())).toContain(
      "karen",
    );
    expect(parsePlaceQuery("Runda, Kiambu")).toEqual({
      place: "Runda",
      countyHint: "Kiambu",
      alternates: [],
    });
  });
});

describe("location seed acceptance", () => {
  it("records IEBC hierarchy counts (47 / 290 / 1450)", () => {
    expect(seedReport.counts.counties).toBe(47);
    expect(seedReport.counts.constituencies).toBe(290);
    expect(seedReport.counts.wards).toBe(1450);
    expect(seedReport.counts.countries).toBe(1);
    expect(seedReport.counts.localities).toBeGreaterThanOrEqual(300);
    expect(seedReport.errors).toEqual([]);
  });
});

describe("SEO area inventory gating", () => {
  it("keeps stable Nairobi static slugs indexable even with low inventory", () => {
    expect(areaFromSlug("kilimani")?.name).toBe("Kilimani");
    expect(areaFromSlug("westlands")?.name).toBe("Westlands");
    expect(
      shouldIndexArea({
        slug: "kilimani",
        name: "Kilimani",
        inventoryCount: 0,
      }),
    ).toBe(true);
  });

  it("noindexes thin non-static areas below threshold", () => {
    expect(
      shouldIndexArea({
        slug: "some-new-estate",
        name: "Some New Estate",
        inventoryCount: SEO_INVENTORY_THRESHOLD - 1,
      }),
    ).toBe(false);
    expect(
      shouldIndexArea({
        slug: "some-new-estate",
        name: "Some New Estate",
        inventoryCount: SEO_INVENTORY_THRESHOLD,
      }),
    ).toBe(true);
    expect(areaSlug("Ngong Road")).toBe("ngong-road");
  });

  it("indexes wards with ≥1 listing (national ward SEO)", () => {
    expect(
      shouldIndexArea({
        slug: "riruta",
        name: "Riruta",
        type: "WARD",
        inventoryCount: SEO_WARD_INVENTORY_THRESHOLD,
      }),
    ).toBe(true);
    expect(
      shouldIndexArea({
        slug: "riruta",
        name: "Riruta",
        type: "WARD",
        inventoryCount: 0,
      }),
    ).toBe(false);
    // Without type, ward-threshold must not apply (regression for resolveAreaFromSlug).
    expect(
      shouldIndexArea({
        slug: "riruta",
        name: "Riruta",
        inventoryCount: 1,
      }),
    ).toBe(false);
  });
});

describe("location match tiers", () => {
  const filterId = "11111111-1111-1111-1111-111111111111";

  it("ranks inside > near > marketed_as", () => {
    expect(
      classifyLocationMatch({
        filterLocationId: filterId,
        property: { location_id: filterId, neighborhood: "Kilimani" },
      }),
    ).toBe("inside");

    expect(
      classifyLocationMatch({
        filterNeighborhood: "Kilimani",
        property: { neighborhood: "Kilimani Area", location_id: null },
      }),
    ).toBe("marketed_as");

    expect(
      classifyLocationMatch({
        filterLocationId: filterId,
        filterLat: -1.28,
        filterLng: 36.78,
        property: {
          location_id: null,
          neighborhood: "Elsewhere",
          latitude: -1.285,
          longitude: 36.785,
        },
        nearKm: 5,
      }),
    ).toBe("near");

    expect(
      compareByLocationTier({ tier: "inside" }, { tier: "near" }),
    ).toBeLessThan(0);
  });
});
