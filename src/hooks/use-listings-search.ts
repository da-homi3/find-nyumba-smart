import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { PropertySearchFilters } from "@/lib/properties";
import { fetchListingsApi } from "@/lib/listings-client";

export function listingsQueryKey(filters: PropertySearchFilters) {
  return [
    "listings",
    filters.query ?? "",
    filters.neighborhood ?? "All",
    filters.minRent ?? null,
    filters.maxRent ?? null,
    filters.sortBy ?? "newest",
    filters.limit ?? 50,
    filters.offset ?? 0,
    filters.propertyType ?? null,
    filters.pricingMode ?? null,
    filters.minBedrooms ?? null,
    filters.verifiedOnly ? 1 : 0,
    filters.originLat != null ? Number(filters.originLat.toFixed(3)) : null,
    filters.originLng != null ? Number(filters.originLng.toFixed(3)) : null,
  ] as const;
}

function shouldRetryListings(failureCount: number, error: Error): boolean {
  const msg = error.message ?? "";
  if (/Too many requests|429/.test(msg)) return false;
  return failureCount < 1;
}

export function useListingsSearch(filters: PropertySearchFilters) {
  return useQuery({
    queryKey: listingsQueryKey(filters),
    queryFn: () => fetchListingsApi(filters),
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: shouldRetryListings,
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 10_000),
  });
}
