import type { Property, PropertySearchFilters } from "@/lib/properties";

/** Kept empty — demo/mock cards are no longer served. */
export const MOCK_PROPERTIES: Property[] = [];

const DEMO_LISTING_IDS = new Set([
  "a1000001-0001-4000-8000-000000000001",
  "a1000001-0001-4000-8000-000000000002",
  "a1000001-0001-4000-8000-000000000003",
  "a1000001-0001-4000-8000-000000000004",
]);

export function getMockProperty(_id: string): Property | null {
  return null;
}

/** True when the listing id was historically a client-side demo UUID. */
export function isDemoListingId(id: string): boolean {
  return DEMO_LISTING_IDS.has(id);
}

/** Demo listings are disabled — always serve live data. */
export function mockListingsEnabled(): boolean {
  return false;
}

export function emptySearchResult(filters?: PropertySearchFilters) {
  const f = filters ?? {};
  const limit = f.limit ?? 50;
  const offset = f.offset ?? 0;
  return { items: [] as Property[], total: 0, limit, offset };
}

export function filterMockListings(filters?: PropertySearchFilters) {
  const f = filters ?? {};
  return {
    items: [] as Property[],
    total: 0,
    limit: f.limit ?? 50,
    offset: f.offset ?? 0,
  };
}
