import type { TenantFilters } from "@/components/TenantFiltersBar";

export const defaultTenantFilters: TenantFilters = {
  minRent: 5000,
  maxRent: 200000,
  types: [],
  neighborhood: "All",
  waterGoodOnly: false,
  verifiedLevel2Plus: false,
  bedrooms: null,
  sort: "newest",
};
