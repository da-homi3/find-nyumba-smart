import type { TenantFilters } from "@/components/TenantFiltersBar";

export const TENANT_MIN_RENT = 5_000;
export const TENANT_MAX_RENT = 59_000_000;
export const TENANT_RENT_STEP = 500_000;

export const defaultTenantFilters: TenantFilters = {
  minRent: TENANT_MIN_RENT,
  maxRent: TENANT_MAX_RENT,
  types: [],
  listingPurpose: "all",
  neighborhood: "All",
  waterGoodOnly: false,
  verifiedLevel2Plus: false,
  bedrooms: null,
  sort: "newest",
};

/** Omit max-rent filter when the slider is at the top ("59M+"). */
export function effectiveMaxRent(maxRent: number | undefined): number | undefined {
  if (maxRent == null || maxRent >= TENANT_MAX_RENT) return undefined;
  return maxRent;
}
