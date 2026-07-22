import type { QueryClient } from "@tanstack/react-query";
import { fetchListingsApi } from "@/lib/listings-client";
import { listingsQueryKey } from "@/hooks/use-listings-search";
import { TENANT_LISTINGS_PAGE_SIZE } from "@/lib/seo/prefetch-tenant-listings";
import { defaultTenantFilters } from "@/lib/tenant-filter-defaults";
import { listSavedProperties, listTenantInquiries } from "@/lib/api/nyumba.functions";

/** Map pin pool — sized for fast client fetch; full browse still paginates separately. */
export const MAP_LISTINGS_LIMIT = 150;
export const MAP_LISTINGS_FILTERS = { limit: MAP_LISTINGS_LIMIT, sortBy: "newest" as const };

/** Client browse warm — matches tenant.index nearby default without SSR over-fetch. */
function clientBrowseFilters() {
  const nearby = defaultTenantFilters.sort === "nearby";
  return {
    maxRent: defaultTenantFilters.maxRent,
    minRent: defaultTenantFilters.minRent,
    sortBy: defaultTenantFilters.sort,
    limit: nearby ? MAP_LISTINGS_LIMIT : TENANT_LISTINGS_PAGE_SIZE,
    offset: 0,
    originLat: nearby ? -1.286389 : undefined,
    originLng: nearby ? 36.817223 : undefined,
  };
}

/** Warm React Query caches before the user taps a bottom-nav tab. */
export function prefetchTenantSection(queryClient: QueryClient, to: string, userId?: string | null) {
  if (to === "/tenant" || to === "/") {
    const filters = clientBrowseFilters();
    void queryClient.prefetchQuery({
      queryKey: listingsQueryKey(filters),
      queryFn: () => fetchListingsApi(filters),
    });
  }

  if (to === "/tenant/map") {
    void queryClient.prefetchQuery({
      queryKey: listingsQueryKey(MAP_LISTINGS_FILTERS),
      queryFn: () => fetchListingsApi(MAP_LISTINGS_FILTERS),
    });
  }

  if (to === "/tenant/saved" && userId) {
    void queryClient.prefetchQuery({
      queryKey: ["saved-properties", userId],
      queryFn: () => listSavedProperties(),
    });
  }

  if (to === "/tenant/messages" && userId) {
    void queryClient.prefetchQuery({
      queryKey: ["tenant-inquiries", userId],
      queryFn: () => listTenantInquiries(),
    });
  }
}
