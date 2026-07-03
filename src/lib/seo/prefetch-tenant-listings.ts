import type { QueryClient } from "@tanstack/react-query";
import { listProperties } from "@/lib/api/nyumba.functions";
import { listingsQueryKey } from "@/hooks/use-listings-search";
import { defaultTenantFilters } from "@/lib/tenant-filter-defaults";

export const TENANT_LISTINGS_PAGE_SIZE = 12;

export function defaultTenantListingFilters() {
  return {
    maxRent: defaultTenantFilters.maxRent,
    minRent: defaultTenantFilters.minRent,
    sortBy: defaultTenantFilters.sort,
    limit: TENANT_LISTINGS_PAGE_SIZE,
    offset: 0,
  } as const;
}

/** Prefetch browse listings during SSR for search-engine readable vacancy cards. */
export async function prefetchTenantListings(queryClient: QueryClient): Promise<void> {
  const filters = defaultTenantListingFilters();
  await queryClient.prefetchQuery({
    queryKey: listingsQueryKey(filters),
    queryFn: () => listProperties({ data: filters }),
  });
}
