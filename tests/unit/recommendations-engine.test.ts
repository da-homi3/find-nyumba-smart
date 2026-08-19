import { describe, expect, it } from "vitest";
import { DEFAULT_RECOMMENDATION_WEIGHTS } from "@/lib/recommendations/config";
import {
  buildShelves,
  diversify,
  isColdStart,
  mergeNeeds,
  moreLikeThis,
  needsFromProperty,
  scoreProperty,
} from "@/lib/recommendations/engine";
import { explainReason } from "@/lib/recommendations/reasons";
import { locationRelation } from "@/lib/recommendations/locations";
import {
  EMPTY_BEHAVIOR,
  EMPTY_NEEDS,
  type RecProperty,
  type TenantNeeds,
} from "@/lib/recommendations/types";

function home(partial: Partial<RecProperty> & { id: string }): RecProperty {
  return {
    title: "Home",
    neighborhood: "Kilimani",
    rentKes: 55000,
    bedrooms: 2,
    bathrooms: 1,
    propertyType: "two_bedroom",
    amenities: ["Parking", "Security"],
    isVerified: true,
    isVacant: true,
    authenticityScore: 80,
    availableFrom: "2026-09-01",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ownerId: "owner-a",
    organizationId: null,
    images: ["a.jpg", "b.jpg", "c.jpg"],
    views: 12,
    ...partial,
  };
}

const needs: TenantNeeds = {
  ...EMPTY_NEEDS,
  budgetMin: 40000,
  budgetMax: 60000,
  locations: ["kilimani"],
  bedrooms: 2,
  parkingRequired: true,
  moveInDate: "2026-09-15",
};

describe("scoreProperty", () => {
  it("scores a strong match with explainable reasons", () => {
    const item = scoreProperty(home({ id: "p1" }), needs, EMPTY_BEHAVIOR, DEFAULT_RECOMMENDATION_WEIGHTS);
    expect(item).not.toBeNull();
    expect(item!.matchScore).toBeGreaterThan(70);
    expect(item!.reasonCodes).toContain("budget_match");
    expect(item!.reasonCodes).toContain("location_match");
    expect(item!.reasonCodes).toContain("bedroom_match");
    expect(item!.reasonCodes).toContain("parking_match");
    expect(item!.reasons).toHaveLength(item!.reasonCodes.length);
  });

  it("labels slightly above budget instead of dropping it", () => {
    const item = scoreProperty(
      home({ id: "p2", rentKes: 62000 }),
      needs,
      EMPTY_BEHAVIOR,
      DEFAULT_RECOMMENDATION_WEIGHTS,
    );
    expect(item).not.toBeNull();
    expect(item!.reasonCodes).toContain("budget_flexible");
    expect(item!.discovery).toBe(true);
  });

  it("does not recommend a property far above budget", () => {
    const item = scoreProperty(
      home({ id: "p3", rentKes: 85000 }),
      needs,
      EMPTY_BEHAVIOR,
      DEFAULT_RECOMMENDATION_WEIGHTS,
    );
    expect(item).toBeNull();
  });

  it("does not recommend rented listings", () => {
    expect(
      scoreProperty(
        home({ id: "p4", isVacant: false }),
        needs,
        EMPTY_BEHAVIOR,
        DEFAULT_RECOMMENDATION_WEIGHTS,
      ),
    ).toBeNull();
  });

  it("does not use a single view as similar behavior", () => {
    const viewed = [home({ id: "v1", neighborhood: "Kilimani", bedrooms: 2, rentKes: 55000 })];
    const item = scoreProperty(
      home({ id: "p5" }),
      needs,
      { ...EMPTY_BEHAVIOR, viewed },
      DEFAULT_RECOMMENDATION_WEIGHTS,
    );
    expect(item?.reasonCodes).not.toContain("viewed_similar");
  });
});

describe("diversify", () => {
  it("caps nearly identical homes from one neighborhood and owner", () => {
    const byId = new Map<string, RecProperty>();
    const scored = [];
    for (let i = 0; i < 8; i++) {
      const property = home({ id: `d${i}`, ownerId: i < 6 ? "same" : `o${i}` });
      byId.set(property.id, property);
      const item = scoreProperty(property, needs, EMPTY_BEHAVIOR, DEFAULT_RECOMMENDATION_WEIGHTS);
      if (item) scored.push(item);
    }
    const out = diversify(scored, byId, DEFAULT_RECOMMENDATION_WEIGHTS);
    const hoods = out.map((s) => byId.get(s.propertyId)?.neighborhood);
    expect(hoods.filter((h) => h === "Kilimani").length).toBeLessThanOrEqual(
      DEFAULT_RECOMMENDATION_WEIGHTS.maxPerNeighborhood,
    );
  });
});

describe("cold start", () => {
  it("is cold start without prefs or behavior", () => {
    expect(isColdStart(EMPTY_NEEDS, EMPTY_BEHAVIOR)).toBe(true);
  });

  it("is not cold start when explicit budget exists", () => {
    expect(isColdStart({ ...EMPTY_NEEDS, budgetMax: 50000 }, EMPTY_BEHAVIOR)).toBe(false);
  });
});

describe("location intelligence", () => {
  it("treats Hurlingham as near Kilimani without replacing it", () => {
    expect(locationRelation("Hurlingham", ["kilimani"])).toBe("nearby");
    expect(locationRelation("Kilimani", ["kilimani"])).toBe("exact");
    expect(locationRelation("Rongai", ["kilimani"])).toBe("none");
  });
});

describe("more like this", () => {
  it("does not recommend solely because of the same provider", () => {
    const source = home({ id: "src", ownerId: "agency-1", neighborhood: "Kilimani", bedrooms: 2 });
    const sameProviderOnly = home({
      id: "other",
      ownerId: "agency-1",
      neighborhood: "Rongai",
      bedrooms: 0,
      rentKes: 12000,
      propertyType: "bedsitter",
      amenities: [],
    });
    const similar = home({
      id: "sim",
      ownerId: "agency-2",
      neighborhood: "Kilimani",
      bedrooms: 2,
      rentKes: 56000,
    });
    const items = moreLikeThis(source, [source, sameProviderOnly, similar], DEFAULT_RECOMMENDATION_WEIGHTS);
    expect(items.map((i) => i.propertyId)).toContain("sim");
    expect(items.map((i) => i.propertyId)).not.toContain("other");
  });
});

describe("reason copy", () => {
  it("explains a price drop with previous and new rent", () => {
    expect(
      explainReason("price_drop", needs, { previousRentKes: 65000, newRentKes: 60000 }),
    ).toContain("60,000");
  });
});

describe("mergeNeeds", () => {
  it("keeps explicit locations over inferred ones", () => {
    const merged = mergeNeeds(needs, { locations: ["rongai"], bedrooms: 3 });
    expect(merged.locations).toEqual(["kilimani"]);
    expect(merged.bedrooms).toBe(2);
  });
});

describe("needsFromProperty", () => {
  it("builds a flexible budget around the seed listing", () => {
    const derived = needsFromProperty(home({ id: "s", rentKes: 50000 }));
    expect(derived.budgetMin).toBe(40000);
    expect(derived.budgetMax).toBe(60000);
  });
});

describe("price drop shelf", () => {
  it("shows a plus-only price drop section for saved homes that got cheaper", () => {
    const property = home({ id: "saved-1" });
    const byId = new Map([[property.id, property]]);
    const scored = [
      scoreProperty(property, needs, EMPTY_BEHAVIOR, DEFAULT_RECOMMENDATION_WEIGHTS)!,
    ];
    const shelves = buildShelves({
      scored,
      byId,
      needs,
      behavior: {
        ...EMPTY_BEHAVIOR,
        saved: [property],
        priceDrops: [{ propertyId: "saved-1", previousRent: 65000, newRent: 55000 }],
      },
      plus: true,
      weights: DEFAULT_RECOMMENDATION_WEIGHTS,
    });
    const drops = shelves.find((s) => s.id === "price_drops");
    expect(drops).toBeTruthy();
    expect(drops!.items[0]?.previousRentKes).toBe(65000);
    expect(drops!.items[0]?.newRentKes).toBe(55000);
  });
});
