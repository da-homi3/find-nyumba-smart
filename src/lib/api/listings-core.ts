import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { PropertySearchFilters } from "@/lib/properties";
import {
  createPublicClient,
  isMissingRevenueColumnError,
  PUBLIC_PROPERTY_COLUMNS,
  PUBLIC_PROPERTY_COLUMNS_LEGACY,
} from "@/lib/api/public-client";
import { effectiveMaxRent } from "@/lib/tenant-filter-defaults";
import { mapPropertyRows } from "@/lib/api/nyumba/nyumba-shared";
import { normalizeNeighborhoodFilter, parseCountyWideFilter } from "@/lib/security/neighborhoods";
import { areasForCounty, matchLocation, neighborhoodStorageValue } from "@/data/kenya-locations";
import { withCache, getListingsCacheEpoch } from "@/lib/cache/manager";
import { sortListingsByProximity } from "@/lib/geo/listings-nearby-sort";
import {
  browseOriginFromGeolocation,
  DEFAULT_BROWSE_ORIGIN,
} from "@/lib/geo/tenant-browse-origin";

export function listingsCacheKey(data?: PropertySearchFilters): string {
  const f = data ?? {};
  const parts = [
    `l${f.limit ?? 50}`,
    `o${f.offset ?? 0}`,
    f.sortBy ?? "newest",
    f.neighborhood ?? "",
    f.propertyType ?? "",
    f.query ?? "",
    f.minRent != null ? String(f.minRent) : "",
    f.maxRent != null ? String(f.maxRent) : "",
    f.pricingMode ?? "",
    f.verifiedOnly ? "v1" : "",
    f.minBedrooms != null ? String(f.minBedrooms) : "",
  ];
  if (f.sortBy === "nearby" && f.originLat != null && f.originLng != null) {
    parts.push(`g${f.originLat.toFixed(3)},${f.originLng.toFixed(3)}`);
  }
  if (f.bounds) {
    parts.push(
      `b${f.bounds.minLat.toFixed(3)},${f.bounds.maxLat.toFixed(3)},${f.bounds.minLng.toFixed(3)},${f.bounds.maxLng.toFixed(3)}`,
    );
  }
  return parts.join("|");
}

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

function applyNeighborhoodFilter(query: PropertyQuery, neighborhood: string | undefined) {
  const normalized = normalizeNeighborhoodFilter(neighborhood);
  if (!normalized) return query;

  const county = parseCountyWideFilter(normalized);
  if (county) {
    const values = [
      ...new Set(
        areasForCounty(county).flatMap((loc) => [
          neighborhoodStorageValue(loc),
          loc.name,
          `${loc.name}, ${loc.county}`,
        ]),
      ),
    ];
    return values.length > 0 ? query.in("neighborhood", values) : query;
  }

  // Match both storage forms so every listing in the area is returned.
  const matched = matchLocation(normalized);
  if (matched) {
    const values = [
      ...new Set([
        normalized,
        neighborhoodStorageValue(matched),
        matched.name,
        `${matched.name}, ${matched.county}`,
      ]),
    ];
    return query.in("neighborhood", values);
  }

  return query.eq("neighborhood", normalized);
}

function applySearchTermFilter(query: PropertyQuery, rawQuery: string | undefined) {
  if (!rawQuery) return query;

  const term = rawQuery
    .replaceAll(",", " ")
    .replace(/[()[\].,:*!%\\]/g, "")
    .trim()
    .slice(0, 100);
  if (!term) return query;

  const typeTerm = term.replaceAll(" ", "_");
  return query.or(
    `title.ilike.*${term}*,neighborhood.ilike.*${term}*,property_type.eq.${typeTerm}`,
  );
}

function applyListingSort(query: PropertyQuery, sortBy: PropertySearchFilters["sortBy"]) {
  switch (sortBy ?? "newest") {
    case "price_asc":
      return query.order("rent_kes", { ascending: true });
    case "price_desc":
      return query.order("rent_kes", { ascending: false });
    case "score":
      return query.order("authenticity_score", { ascending: false });
    case "nearby":
      // Final order applied in-memory after fetch (needs origin lat/lng).
      return query.order("created_at", { ascending: false });
    default:
      return query.order("created_at", { ascending: false });
  }
}

function applyListingFilters(query: PropertyQuery, data: PropertySearchFilters | undefined) {
  let next = query.eq("is_active", true);
  next = applyNeighborhoodFilter(next, data?.neighborhood);
  if (data?.propertyType) next = next.eq("property_type", data.propertyType);
  if (data?.pricingMode === "sale") {
    next = next.eq("pricing_mode", "sale");
  } else if (data?.pricingMode === "rent") {
    // Legacy rows may omit pricing_mode; treat null as rent.
    next = next.or("pricing_mode.eq.rent,pricing_mode.is.null");
  }
  if (data?.minRent) next = next.gte("rent_kes", data.minRent);
  const maxRent = effectiveMaxRent(data?.maxRent);
  if (maxRent) next = next.lte("rent_kes", maxRent);
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
  next = applySearchTermFilter(next, data?.query);
  return applyListingSort(next, data?.sortBy);
}

function isCurrentlyBoosted(featuredUntil: string | null | undefined, now: number): boolean {
  return Boolean(featuredUntil && new Date(featuredUntil).getTime() > now);
}

/** Hard cap for any public listings request — protects Worker CPU + payload size. */
export const MAX_LISTINGS_LIMIT = 300;
/** Pool size for nearby sort before distance slicing (matches hard cap). */
const NEARBY_POOL_LIMIT = MAX_LISTINGS_LIMIT;

async function runListingsSelect(
  supabase: Db,
  columns: string,
  data: PropertySearchFilters | undefined,
) {
  const rawLimit = Number(data?.limit ?? 50);
  const rawOffset = Number(data?.offset ?? 0);
  const requestedLimit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50, 1),
    MAX_LISTINGS_LIMIT,
  );
  const offset = Math.max(Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0, 0);
  // Nearby ranking needs a wider pool before distance/neighborhood sort + slice.
  const fetchLimit =
    data?.sortBy === "nearby"
      ? Math.min(Math.max(requestedLimit, NEARBY_POOL_LIMIT), NEARBY_POOL_LIMIT)
      : requestedLimit;
  const fetchOffset = data?.sortBy === "nearby" ? 0 : offset;
  const query = applyListingFilters(buildPropertySelect(supabase, columns), data).range(
    fetchOffset,
    fetchOffset + fetchLimit - 1,
  );

  const { data: rows, error, count } = await query;
  return { rows, error, count, limit: requestedLimit, offset };
}

/** Public listings query — retries with legacy columns when revenue fields are missing. */
export async function queryListingsDirect(
  data?: PropertySearchFilters,
  supabase: Db = createPublicClient(),
): Promise<ListingsResult> {
  const { withCircuitBreaker } = await import("@/lib/resilience/circuit-breaker");

  return withCircuitBreaker("listings-supabase", async () => {
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

    if (error) throw error;

    let items = mapPropertyRows((rows ?? []) as unknown as Parameters<typeof mapPropertyRows>[0]).map(
      (item) => ({
        ...item,
        // List/map responses: keep card thumbs only — full gallery loads on detail.
        images: item.images.slice(0, 3),
        description: null,
        video_url: null,
        tour_url: null,
      }),
    );
    const now = Date.now();

    if (data?.sortBy === "nearby") {
      const origin =
        data.originLat != null && data.originLng != null
          ? browseOriginFromGeolocation(data.originLat, data.originLng)
          : DEFAULT_BROWSE_ORIGIN;
      items = sortListingsByProximity(items, origin, now);
      items = items.slice(offset, offset + limit);
    } else if (data?.sortBy === "score") {
      // Keep authenticity order from SQL; optionally surface boosted listings first.
      items = [...items].sort((a, b) => {
        const aBoosted = isCurrentlyBoosted(a.featured_until, now) ? 1 : 0;
        const bBoosted = isCurrentlyBoosted(b.featured_until, now) ? 1 : 0;
        if (aBoosted !== bBoosted) return bBoosted - aBoosted;
        return 0;
      });
    }
    // newest / price_*: preserve SQL order (newest→oldest for default).

    const total = count ?? items.length;

    return { items, total, limit, offset };
  });
}

export async function queryListings(
  data?: PropertySearchFilters,
  supabase: Db = createPublicClient(),
): Promise<ListingsResult> {
  const epoch = await getListingsCacheEpoch();
  const key = `e${epoch}|${listingsCacheKey(data)}`;
  const { data: result } = await withCache(key, "listings_search", () =>
    queryListingsDirect(data, supabase),
  );
  return result;
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
