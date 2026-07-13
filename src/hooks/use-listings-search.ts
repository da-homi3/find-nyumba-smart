import { useQuery } from "@tanstack/react-query";
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
    filters.minBedrooms ?? null,
  ] as const;
}

export function useListingsSearch(filters: PropertySearchFilters) {
  return useQuery({
    queryKey: listingsQueryKey(filters),
    queryFn: () => fetchListingsApi(filters),
    staleTime: 90_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
