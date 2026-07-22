import type { QueryClient } from "@tanstack/react-query";
import { listProperties } from "@/lib/api/nyumba.functions";
import { listingsQueryKey } from "@/hooks/use-listings-search";
import { defaultTenantFilters, effectiveMaxRent } from "@/lib/tenant-filter-defaults";

export const TENANT_LISTINGS_PAGE_SIZE = 12;

/**
 * SSR/SEO prefetch: small newest page so TTFB stays low.
 * Must match client `listingFilters` normalization (effectiveMaxRent → undefined at ceiling).
 */
export function defaultTenantListingFilters() {
  return {
    maxRent: effectiveMaxRent(defaultTenantFilters.maxRent),
    minRent: defaultTenantFilters.minRent,
    sortBy: "newest" as const,
    limit: TENANT_LISTINGS_PAGE_SIZE,
    offset: 0,
  };
}

/** Prefetch browse listings during SSR for search-engine readable vacancy cards. */
export async function prefetchTenantListings(queryClient: QueryClient): Promise<void> {
  const filters = defaultTenantListingFilters();
  await queryClient.prefetchQuery({
    queryKey: listingsQueryKey(filters),
    queryFn: () => listProperties({ data: filters }),
  });
}
