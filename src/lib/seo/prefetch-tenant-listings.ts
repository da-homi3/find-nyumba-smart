import type { QueryClient } from "@tanstack/react-query";
import { listProperties } from "@/lib/api/nyumba.functions";
import { listingsQueryKey } from "@/hooks/use-listings-search";
import { defaultTenantFilters, effectiveMaxRent } from "@/lib/tenant-filter-defaults";

export const TENANT_LISTINGS_PAGE_SIZE = 12;

/** Bound SSR wait so a slow Supabase never hangs `/tenant` TTFB. */
const TENANT_PREFETCH_TIMEOUT_MS = 3_500;

/**
 * SSR/SEO prefetch: small newest page so TTFB stays low.
 * Must match client `listingFilters` normalization (effectiveMaxRent → undefined at ceiling).
 */
export function defaultTenantListingFilters() {
  return {
    maxRent: effectiveMaxRent(defaultTenantFilters.maxRent),
    minRent: defaultTenantFilters.minRent > 0 ? defaultTenantFilters.minRent : undefined,
    sortBy: "newest" as const,
    limit: TENANT_LISTINGS_PAGE_SIZE,
    offset: 0,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[tenant] ${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Prefetch browse listings during SSR for search-engine readable vacancy cards. */
export async function prefetchTenantListings(queryClient: QueryClient): Promise<void> {
  const filters = defaultTenantListingFilters();
  try {
    await withTimeout(
      queryClient.prefetchQuery({
        queryKey: listingsQueryKey(filters),
        queryFn: () => listProperties({ data: filters }),
      }),
      TENANT_PREFETCH_TIMEOUT_MS,
      "browse listings",
    );
  } catch (err) {
    // Fail open — client useListingsSearch refills; never hang the Worker on /tenant SSR.
    console.warn("[tenant] listings prefetch skipped", err);
  }
}
