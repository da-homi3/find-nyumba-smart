import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { PropertySearchFilters } from "@/lib/properties";
import {
  createPublicClient,
  isMissingRevenueColumnError,
  PUBLIC_PROPERTY_COLUMNS,
  PUBLIC_PROPERTY_COLUMNS_LEGACY,
} from "@/lib/api/public-client";
import { filterMockListings, mockListingsEnabled } from "@/data/mockListings";
import { mapPropertyRows } from "@/lib/api/nyumba/nyumba-shared";
import { normalizeNeighborhoodFilter } from "@/lib/security/neighborhoods";

export type ListingsResult = {
  items: ReturnType<typeof mapPropertyRows>;
  total: number;
  limit: number;
  offset: number;
};

type Db = SupabaseClient<Database>;

function buildPropertySelect(supabase: Db, columns: string) {
  return supabase.from("properties").select(columns, { count: "exact" });
}

type PropertyQuery = ReturnType<typeof buildPropertySelect>;

function applyListingFilters(query: PropertyQuery, data: PropertySearchFilters | undefined) {
  let next = query.eq("is_active", true);

  const neighborhood = normalizeNeighborhoodFilter(data?.neighborhood);
  if (neighborhood) {
    next = next.eq("neighborhood", neighborhood);
  }
  if (data?.propertyType) next = next.eq("property_type", data.propertyType);
  if (data?.minRent) next = next.gte("rent_kes", data.minRent);
  if (data?.maxRent) next = next.lte("rent_kes", data.maxRent);
  if (data?.verifiedOnly) next = next.eq("is_verified", true);
  if (data?.minBedrooms) next = next.gte("bedrooms", data.minBedrooms);
  if (data?.minAuthenticityScore) {
    next = next.gte("authenticity_score", data.minAuthenticityScore);
  }
  if (data?.bounds) {
    next = next
      .gte("latitude", data.bounds.minLat)
      .lte("latitude", data.bounds.maxLat)
      .gte("longitude", data.bounds.minLng)
      .lte("longitude", data.bounds.maxLng);
  }
  if (data?.query) {
    const term = data.query
      .replaceAll(",", " ")
      .replace(/[()[\].,:*!%\\]/g, "")
      .trim()
      .slice(0, 100);
    if (term) {
      const typeTerm = term.replaceAll(" ", "_");
      next = next.or(
        `title.ilike.*${term}*,neighborhood.ilike.*${term}*,property_type.eq.${typeTerm}`,
      );
    }
  }

  switch (data?.sortBy ?? "newest") {
    case "price_asc":
      next = next.order("rent_kes", { ascending: true });
      break;
    case "price_desc":
      next = next.order("rent_kes", { ascending: false });
      break;
    case "score":
      next = next.order("authenticity_score", { ascending: false });
      break;
    default:
      next = next.order("created_at", { ascending: false });
  }

  return next;
}

function isCurrentlyBoosted(featuredUntil: string | null | undefined, now: number): boolean {
  return Boolean(featuredUntil && new Date(featuredUntil).getTime() > now);
}

async function runListingsSelect(
  supabase: Db,
  columns: string,
  data: PropertySearchFilters | undefined,
) {
  const limit = Math.min(Math.max(data?.limit ?? 50, 1), 500);
  const offset = Math.max(data?.offset ?? 0, 0);
  const query = applyListingFilters(buildPropertySelect(supabase, columns), data).range(
    offset,
    offset + limit - 1,
  );

  const { data: rows, error, count } = await query;
  return { rows, error, count, limit, offset };
}

/** Public listings query — retries with legacy columns when revenue fields are missing. */
export async function queryListings(
  data?: PropertySearchFilters,
  supabase: Db = createPublicClient(),
): Promise<ListingsResult> {
  let { rows, error, count, limit, offset } = await runListingsSelect(
    supabase,
    PUBLIC_PROPERTY_COLUMNS,
    data,
  );

  if (error && isMissingRevenueColumnError(error.message)) {
    const legacy = await runListingsSelect(supabase, PUBLIC_PROPERTY_COLUMNS_LEGACY, data);
    rows = legacy.rows;
    error = legacy.error;
    count = legacy.count;
    limit = legacy.limit;
    offset = legacy.offset;
  }

  // Keep local/explicit mock previews usable when Supabase is unavailable.
  if (error && mockListingsEnabled()) {
    const limit = Math.min(Math.max(data?.limit ?? 50, 1), 500);
    const offset = Math.max(data?.offset ?? 0, 0);
    const mockResult = filterMockListings({
      neighborhood: data?.neighborhood,
      propertyType: data?.propertyType,
      minRent: data?.minRent,
      maxRent: data?.maxRent,
      verifiedOnly: data?.verifiedOnly,
      minBedrooms: data?.minBedrooms,
      minAuthenticityScore: data?.minAuthenticityScore,
      bounds: data?.bounds,
      query: data?.query,
      sortBy: data?.sortBy,
      limit,
      offset,
    });
    return mockResult;
  }

  if (error) throw error;

  let items = mapPropertyRows((rows ?? []) as unknown as Parameters<typeof mapPropertyRows>[0]);
  const now = Date.now();
  items = [...items].sort((a, b) => {
    const aBoosted = isCurrentlyBoosted(a.featured_until, now) ? 1 : 0;
    const bBoosted = isCurrentlyBoosted(b.featured_until, now) ? 1 : 0;
    if (aBoosted !== bBoosted) return bBoosted - aBoosted;
    return 0;
  });
  let total = count ?? items.length;

  if (mockListingsEnabled()) {
    const mockResult = filterMockListings({
      neighborhood: data?.neighborhood,
      propertyType: data?.propertyType,
      minRent: data?.minRent,
      maxRent: data?.maxRent,
      verifiedOnly: data?.verifiedOnly,
      minBedrooms: data?.minBedrooms,
      minAuthenticityScore: data?.minAuthenticityScore,
      bounds: data?.bounds,
      query: data?.query,
      sortBy: data?.sortBy,
      limit,
      offset,
    });
    const liveIds = new Set(items.map((item) => item.id));
    const extras = mockResult.items.filter((item) => !liveIds.has(item.id));
    items = [...items, ...extras];
    total = items.length;
  }

  return { items, total, limit, offset };
}

export async function listingsHealthCheck(): Promise<{
  ok: boolean;
  activeCount: number;
  verifiedCount: number;
  error?: string;
}> {
  try {
    const supabase = createPublicClient();
    const [activeRes, verifiedRes] = await Promise.all([
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_verified", true),
    ]);
    if (activeRes.error) {
      return { ok: false, activeCount: 0, verifiedCount: 0, error: activeRes.error.message };
    }
    return {
      ok: (activeRes.count ?? 0) > 0,
      activeCount: activeRes.count ?? 0,
      verifiedCount: verifiedRes.count ?? 0,
    };
  } catch (err) {
    return {
      ok: false,
      activeCount: 0,
      verifiedCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
