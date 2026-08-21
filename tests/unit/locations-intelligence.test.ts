import { describe, expect, it } from "vitest";
import {
  countyLookupKey,
  normalizeLocationName,
  parsePlaceQuery,
  slugifyLocationName,
} from "@/lib/locations/normalize";
import { shouldIndexArea, areaFromSlug, areaSlug } from "@/lib/seo/areas";
import { SEO_INVENTORY_THRESHOLD } from "@/lib/locations/types";
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
    });
    expect(parsePlaceQuery("Kangemi, Nairobi")).toEqual({
      place: "Kangemi",
      countyHint: "Nairobi",
    });
    expect(parsePlaceQuery("westland").place.toLowerCase()).toBe("westland");
    expect(parsePlaceQuery("Ruaka").countyHint).toBeNull();
    expect(parsePlaceQuery("CBD").place).toBe("CBD");
  });

  it("scrubs landlord noise without inventing places", () => {
    expect(parsePlaceQuery("Gigiri(UN ZONE)")).toEqual({
      place: "Gigiri",
      countyHint: null,
    });
    expect(parsePlaceQuery("Kileleshwa, vihiga road")).toEqual({
      place: "Kileleshwa",
      countyHint: null,
    });
    expect(parsePlaceQuery("Along Ngong Road")).toEqual({
      place: "Ngong Road",
      countyHint: null,
    });
    expect(parsePlaceQuery("Ngong Road").place).toBe("Ngong Road");
    expect(parsePlaceQuery("Karen near tangaza university").place).toBe("Karen");
    expect(parsePlaceQuery("Runda, Kiambu").countyHint?.toLowerCase()).toBe("kiambu");
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
});
