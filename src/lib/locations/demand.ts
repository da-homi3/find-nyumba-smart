import type { LocationsDb } from "./db";
import { normalizeLocationName } from "./normalize";

export type LocationDemandRow = {
  locationId: string | null;
  name: string;
  type: string | null;
  inventoryCount: number;
  searchCount: number;
  viewCount: number;
  inquiryProxy: number;
  demandScore: number;
  needsReviewCount: number;
};

/** Aggregate demand from inventory, search_events, location_search_events, and property views. */
export async function loadLocationDemand(
  admin: LocationsDb,
  options?: { days?: number; limit?: number },
): Promise<LocationDemandRow[]> {
  const days = Math.min(Math.max(options?.days ?? 30, 1), 90);
  const limit = Math.min(Math.max(options?.limit ?? 50, 5), 200);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: locs }, { data: searches }, { data: locSearches }, { data: views }, { data: reviewProps }] =
    await Promise.all([
      admin
        .from("locations")
        .select("id,name,location_type,inventory_count")
        .eq("is_active", true)
        .in("location_type", ["NEIGHBOURHOOD", "LOCALITY", "WARD", "ESTATE", "COUNTY"])
        .order("inventory_count", { ascending: false })
        .limit(500),
      admin
        .from("search_events")
        .select("neighborhood,location_id,result_count")
        .gte("created_at", since)
        .limit(5000),
      admin
        .from("location_search_events")
        .select("normalized_query,selected_location_id,result_count")
        .gte("created_at", since)
        .limit(5000),
      admin
        .from("property_views")
        .select("property_id")
        .gte("created_at", since)
        .limit(8000),
      admin
        .from("properties")
        .select("location_id")
        .eq("location_needs_review", true)
        .not("location_id", "is", null)
        .limit(2000),
    ]);

  const byId = new Map<string, LocationDemandRow>();
  for (const loc of locs ?? []) {
    byId.set(loc.id as string, {
      locationId: loc.id as string,
      name: String(loc.name),
      type: String(loc.location_type),
      inventoryCount: Number(loc.inventory_count ?? 0),
      searchCount: 0,
      viewCount: 0,
      inquiryProxy: 0,
      demandScore: 0,
      needsReviewCount: 0,
    });
  }

  const byName = new Map<string, string>();
  for (const row of byId.values()) {
    byName.set(normalizeLocationName(row.name), row.locationId!);
  }

  for (const s of searches ?? []) {
    const lid = (s as { location_id?: string | null }).location_id;
    const hood = normalizeLocationName(String((s as { neighborhood?: string | null }).neighborhood ?? ""));
    const id = lid ?? byName.get(hood);
    if (!id) continue;
    const row = byId.get(id);
    if (row) row.searchCount += 1;
  }

  for (const s of locSearches ?? []) {
    const lid = (s as { selected_location_id?: string | null }).selected_location_id;
    const q = normalizeLocationName(String((s as { normalized_query?: string | null }).normalized_query ?? ""));
    const id = lid ?? byName.get(q);
    if (!id) continue;
    const row = byId.get(id);
    if (row) row.searchCount += 1;
  }

  for (const r of reviewProps ?? []) {
    const id = (r as { location_id?: string | null }).location_id;
    if (!id) continue;
    const row = byId.get(id);
    if (row) row.needsReviewCount += 1;
  }

  // Attribute views via property → location_id
  const propertyIds = [...new Set((views ?? []).map((v) => (v as { property_id: string }).property_id))];
  if (propertyIds.length) {
    const chunk = propertyIds.slice(0, 1500);
    const { data: props } = await admin
      .from("properties")
      .select("id,location_id")
      .in("id", chunk);
    const propLoc = new Map(
      (props ?? []).map((p) => [p.id as string, (p as { location_id: string | null }).location_id]),
    );
    for (const v of views ?? []) {
      const pid = (v as { property_id: string }).property_id;
      const lid = propLoc.get(pid);
      if (!lid) continue;
      const row = byId.get(lid);
      if (row) row.viewCount += 1;
    }
  }

  const rows = [...byId.values()].map((row) => {
    const demandScore =
      row.searchCount * 3 + row.viewCount * 2 + row.inventoryCount * 1.5 - row.needsReviewCount * 0.5;
    return { ...row, demandScore: Math.round(demandScore * 10) / 10 };
  });

  rows.sort((a, b) => b.demandScore - a.demandScore || b.searchCount - a.searchCount);
  return rows.slice(0, limit);
}
