import { describe, expect, it } from "vitest";
import {
  hasAlertableCriteria,
  listingMatchesSavedSearch,
  savedSearchDisplayName,
  tenantFiltersToSavedCriteria,
} from "@/lib/search/saved-search-criteria";
import { defaultTenantFilters } from "@/lib/tenant-filter-defaults";

describe("saved-search-criteria", () => {
  it("maps browse filters to alert criteria including legacy maxBudget", () => {
    const criteria = tenantFiltersToSavedCriteria({
      ...defaultTenantFilters,
      neighborhood: "Kilimani",
      maxRent: 60_000,
      types: ["one_bedroom"],
      bedrooms: 2,
    });
    expect(criteria.neighborhood).toBe("Kilimani");
    expect(criteria.maxBudget).toBe(60_000);
    expect(criteria.maxRent).toBe(60_000);
    expect(criteria.propertyType).toBe("one_bedroom");
    expect(criteria.bedrooms).toBe(2);
    expect(hasAlertableCriteria(criteria)).toBe(true);
    expect(savedSearchDisplayName(criteria)).toMatch(/Kilimani/);
  });

  it("rejects empty default filters", () => {
    expect(hasAlertableCriteria(tenantFiltersToSavedCriteria(defaultTenantFilters))).toBe(false);
  });

  it("matches listings with browse + legacy keys", () => {
    const listing = {
      neighborhood: "Kilimani",
      property_type: "one_bedroom",
      rent_kes: 55_000,
      bedrooms: 2,
      pricing_mode: "rent",
      is_verified: true,
    };
    expect(
      listingMatchesSavedSearch(listing, {
        neighborhood: "Kilimani",
        maxBudget: 60_000,
        propertyType: "one_bedroom",
      }),
    ).toBe(true);
    expect(
      listingMatchesSavedSearch(listing, {
        neighborhood: "Westlands",
        maxBudget: 60_000,
      }),
    ).toBe(false);
    expect(
      listingMatchesSavedSearch(listing, {
        types: ["bedsitter"],
        maxRent: 60_000,
      }),
    ).toBe(false);
    expect(
      listingMatchesSavedSearch(listing, {
        bedrooms: 3,
      }),
    ).toBe(false);
  });

  it("persists and matches parking / petFriendly amenity filters", () => {
    const criteria = tenantFiltersToSavedCriteria({
      ...defaultTenantFilters,
      parking: true,
      petFriendly: true,
    });
    expect(criteria.parking).toBe(true);
    expect(criteria.petFriendly).toBe(true);
    expect(hasAlertableCriteria(criteria)).toBe(true);

    const withAmenities = {
      neighborhood: "Kilimani",
      property_type: "one_bedroom",
      rent_kes: 55_000,
      amenities: ["Parking", "Pet friendly", "WiFi"],
    };
    expect(listingMatchesSavedSearch(withAmenities, criteria)).toBe(true);
    expect(listingMatchesSavedSearch({ ...withAmenities, amenities: ["WiFi"] }, criteria)).toBe(
      false,
    );
  });
});
