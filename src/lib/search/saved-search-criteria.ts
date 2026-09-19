import type { TenantFilters } from "@/components/TenantFiltersBar";
import { TENANT_MAX_RENT, TENANT_MIN_RENT } from "@/lib/tenant-filter-defaults";
import { formatRentBudget } from "@/lib/format-rent-budget";

/** Persisted filters for saved_searches.criteria / .filters (browse + legacy keys). */
export type SavedSearchCriteria = {
  neighborhood?: string;
  propertyType?: string;
  maxBudget?: number;
  frequency?: "instant" | "daily" | "weekly";
  minRent?: number;
  maxRent?: number;
  types?: string[];
  bedrooms?: number;
  locationId?: string;
  listingPurpose?: "rent" | "sale" | "all";
  verifiedLevel2Plus?: boolean;
  waterGoodOnly?: boolean;
  parking?: boolean;
  petFriendly?: boolean;
};

export type MatchableListing = {
  neighborhood?: string | null;
  property_type?: string | null;
  rent_kes: number;
  bedrooms?: number | null;
  pricing_mode?: string | null;
  is_verified?: boolean | null;
  location_id?: string | null;
  ward_location_id?: string | null;
  constituency_location_id?: string | null;
  county_location_id?: string | null;
  amenities?: string[] | null;
};

export function tenantFiltersToSavedCriteria(filters: TenantFilters): SavedSearchCriteria {
  const criteria: SavedSearchCriteria = { frequency: "instant" };

  if (filters.neighborhood && filters.neighborhood !== "All") {
    criteria.neighborhood = filters.neighborhood;
  }
  if (filters.locationId) {
    criteria.locationId = filters.locationId;
  }
  if (filters.types.length === 1) {
    criteria.propertyType = filters.types[0];
    criteria.types = [...filters.types];
  } else if (filters.types.length > 1) {
    criteria.types = [...filters.types];
  }
  if (filters.maxRent < TENANT_MAX_RENT) {
    criteria.maxRent = filters.maxRent;
    criteria.maxBudget = filters.maxRent;
  }
  if (filters.minRent > TENANT_MIN_RENT) {
    criteria.minRent = filters.minRent;
  }
  if (filters.bedrooms != null) {
    criteria.bedrooms = filters.bedrooms;
  }
  if (filters.listingPurpose !== "all") {
    criteria.listingPurpose = filters.listingPurpose;
  }
  if (filters.verifiedLevel2Plus) {
    criteria.verifiedLevel2Plus = true;
  }
  if (filters.waterGoodOnly) {
    criteria.waterGoodOnly = true;
  }
  if (filters.parking) {
    criteria.parking = true;
  }
  if (filters.petFriendly) {
    criteria.petFriendly = true;
  }

  return criteria;
}

export function savedSearchDisplayName(criteria: SavedSearchCriteria): string {
  const parts: string[] = [];
  if (criteria.neighborhood) parts.push(criteria.neighborhood);
  if (criteria.types?.length) {
    parts.push(criteria.types.map((t) => t.replaceAll("_", " ")).join(", "));
  } else if (criteria.propertyType && criteria.propertyType !== "any") {
    parts.push(criteria.propertyType.replaceAll("_", " "));
  }
  if (criteria.bedrooms != null) {
    parts.push(`${criteria.bedrooms}+ bed`);
  }
  const max = criteria.maxRent ?? criteria.maxBudget;
  if (max != null) {
    parts.push(`under ${formatRentBudget(max)}`);
  }
  if (criteria.listingPurpose === "sale") parts.push("for sale");
  if (criteria.listingPurpose === "rent") parts.push("for rent");
  if (criteria.verifiedLevel2Plus) parts.push("verified");
  if (criteria.parking) parts.push("parking");
  if (criteria.petFriendly) parts.push("pet friendly");
  if (parts.length === 0) return "Nairobi homes";
  return parts.join(" · ").slice(0, 100);
}

export function hasAlertableCriteria(criteria: SavedSearchCriteria): boolean {
  return Boolean(
    criteria.neighborhood ||
    criteria.locationId ||
    criteria.propertyType ||
    (criteria.types && criteria.types.length > 0) ||
    criteria.maxBudget != null ||
    criteria.maxRent != null ||
    criteria.minRent != null ||
    criteria.bedrooms != null ||
    (criteria.listingPurpose && criteria.listingPurpose !== "all") ||
    criteria.verifiedLevel2Plus ||
    criteria.waterGoodOnly ||
    criteria.parking ||
    criteria.petFriendly,
  );
}

function locationMatches(property: MatchableListing, locationId: string): boolean {
  return (
    property.location_id === locationId ||
    property.ward_location_id === locationId ||
    property.constituency_location_id === locationId ||
    property.county_location_id === locationId
  );
}

/** Match a live listing against stored saved-search criteria (instant + digest). */
export function listingMatchesSavedSearch(
  property: MatchableListing,
  raw: SavedSearchCriteria | Record<string, unknown> | null | undefined,
): boolean {
  if (!raw || typeof raw !== "object") return true;
  const criteria = raw as SavedSearchCriteria;

  if (criteria.locationId && !locationMatches(property, criteria.locationId)) {
    return false;
  }

  if (criteria.neighborhood) {
    const hood = criteria.neighborhood.toLowerCase();
    if (!property.neighborhood?.toLowerCase().includes(hood)) return false;
  }

  const types =
    criteria.types && criteria.types.length > 0
      ? criteria.types
      : criteria.propertyType && criteria.propertyType !== "any"
        ? [criteria.propertyType]
        : [];
  if (types.length > 0) {
    if (!property.property_type || !types.includes(property.property_type)) return false;
  }

  const max = criteria.maxRent ?? criteria.maxBudget;
  if (max != null && property.rent_kes > max) return false;

  if (criteria.minRent != null && property.rent_kes < criteria.minRent) return false;

  if (criteria.bedrooms != null) {
    if ((property.bedrooms ?? 0) < criteria.bedrooms) return false;
  }

  if (criteria.listingPurpose === "rent" || criteria.listingPurpose === "sale") {
    const mode = property.pricing_mode ?? "rent";
    if (mode !== criteria.listingPurpose) return false;
  }

  if (criteria.verifiedLevel2Plus && !property.is_verified) return false;

  // waterGoodOnly is browse-only intel; skip strict match until stored on properties.

  if (criteria.parking || criteria.petFriendly) {
    const amenities = property.amenities ?? [];
    if (criteria.parking && !amenities.includes("Parking")) return false;
    if (criteria.petFriendly && !amenities.includes("Pet friendly")) return false;
  }

  return true;
}

/** Map criteria back toward tenant browse URL search params. */
export function savedCriteriaToTenantSearch(criteria: SavedSearchCriteria): {
  neighborhood?: string;
  locationId?: string;
  maxPrice?: number;
  type?: string;
  purpose?: "rent" | "sale";
} {
  return {
    neighborhood: criteria.neighborhood,
    locationId: criteria.locationId,
    maxPrice: criteria.maxRent ?? criteria.maxBudget,
    type:
      criteria.types?.[0] ?? (criteria.propertyType !== "any" ? criteria.propertyType : undefined),
    purpose:
      criteria.listingPurpose === "rent" || criteria.listingPurpose === "sale"
        ? criteria.listingPurpose
        : undefined,
  };
}
