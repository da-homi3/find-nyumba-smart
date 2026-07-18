import type { QueryClient } from "@tanstack/react-query";
import { fetchListingsApi } from "@/lib/listings-client";
import { listingsQueryKey } from "@/hooks/use-listings-search";
import { defaultTenantListingFilters } from "@/lib/seo/prefetch-tenant-listings";
import { listSavedProperties, listTenantInquiries } from "@/lib/api/nyumba.functions";

export const MAP_LISTINGS_FILTERS = { limit: 500, sortBy: "newest" as const };

/** Warm React Query caches before the user taps a bottom-nav tab. */
export function prefetchTenantSection(queryClient: QueryClient, to: string, userId?: string | null) {
  if (to === "/tenant" || to === "/") {
    const filters = defaultTenantListingFilters();
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
