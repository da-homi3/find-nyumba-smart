import type { LocationsDb } from "./db";
import { haversineKm, normalizeLocationName, parsePlaceQuery, editDistance } from "./normalize";
import { toPublicLocation, typeBoost } from "./format";
import type { LocationRow, LocationSearchHit } from "./types";
import { SEARCHABLE_TYPES } from "./types";

const SELECT_COLS =
  "id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,is_official,confidence_score,inventory_count,source";

function scoreNameMatch(
  normalizedName: string,
  query: string,
): { score: number; via: LocationSearchHit["matchVia"] } {
  if (normalizedName === query) return { score: 100, via: "name" };
  if (normalizedName.startsWith(query)) return { score: 88, via: "prefix" };
  if (normalizedName.includes(query)) return { score: 72, via: "name" };
  const dist = editDistance(normalizedName.slice(0, query.length + 2), query);
  if (query.length >= 4 && dist === 1) return { score: 65, via: "name" };
  if (query.length >= 5 && dist === 2) return { score: 50, via: "name" };
  return { score: 0, via: "name" };
}

export type LocationSearchOptions = {
  q: string;
  limit?: number;
  types?: string[];
  lat?: number;
  lng?: number;
  countyId?: string;
};

export async function searchLocationsDb(
  supabase: LocationsDb,
  options: LocationSearchOptions,
): Promise<LocationSearchHit[]> {
  const { place, countyHint } = parsePlaceQuery(options.q);
  const query = normalizeLocationName(place);
  if (query.length < 2) return [];

  const limit = Math.min(Math.max(options.limit ?? 12, 1), 40);
  const types = options.types?.length ? options.types : [...SEARCHABLE_TYPES];

  let nameQuery = supabase
    .from("locations")
    .select(SELECT_COLS)
    .eq("is_active", true)
    .in("location_type", types)
    .ilike("normalized_name", `%${query}%`)
    .limit(60);

  if (options.countyId) {
    nameQuery = nameQuery.eq("parent_id", options.countyId);
  }

  const [{ data: nameRows }, { data: aliasRows }] = await Promise.all([
    nameQuery,
    supabase
      .from("location_aliases")
      .select(
        "location_id,normalized_alias,locations!inner(id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,is_official,confidence_score,inventory_count,source,is_active)",
      )
      .ilike("normalized_alias", `%${query}%`)
      .limit(40),
  ]);

  const byId = new Map<
    string,
    { row: LocationRow; score: number; via: LocationSearchHit["matchVia"] }
  >();

  for (const raw of nameRows ?? []) {
    const row = raw as unknown as LocationRow;
    const { score, via } = scoreNameMatch(row.normalized_name, query);
    if (score <= 0) continue;
    const boosted = score + typeBoost(row.location_type) + (row.is_official ? 5 : 0);
    const prev = byId.get(row.id);
    if (!prev || boosted > prev.score) byId.set(row.id, { row, score: boosted, via });
  }

  for (const alias of aliasRows ?? []) {
    const loc = (alias as { locations: LocationRow & { is_active: boolean } }).locations;
    if (!loc?.is_active) continue;
    if (!types.includes(loc.location_type)) continue;
    const aliasNorm = String((alias as { normalized_alias: string }).normalized_alias ?? "");
    const { score } = scoreNameMatch(aliasNorm, query);
    if (score <= 0) continue;
    const boosted = score + typeBoost(loc.location_type) + 8;
    const prev = byId.get(loc.id);
    if (!prev || boosted > prev.score) {
      byId.set(loc.id, { row: loc, score: boosted, via: "alias" });
    }
  }

  let hits = [...byId.values()];

  if (countyHint) {
    const hint = normalizeLocationName(countyHint);
    const parentIds = [...new Set(hits.map((h) => h.row.parent_id).filter(Boolean))] as string[];
    if (parentIds.length) {
      const { data: parents } = await supabase
        .from("locations")
        .select("id,normalized_name,name")
        .in("id", parentIds);
      const parentMap = new Map((parents ?? []).map((p) => [p.id as string, p]));
      hits = hits.filter((h) => {
        if (!h.row.parent_id) return true;
        const p = parentMap.get(h.row.parent_id);
        if (!p) return true;
        const pn = String(p.normalized_name ?? "");
        return (
          pn.includes(hint) ||
          hint.includes(pn) ||
          normalizeLocationName(String(p.name ?? "")).includes(hint)
        );
      });
    }
  }

  const withDist: LocationSearchHit[] = hits.map(({ row, score, via }) => {
    let distanceKm: number | undefined;
    let finalScore = score;
    if (
      options.lat != null &&
      options.lng != null &&
      row.latitude != null &&
      row.longitude != null
    ) {
      distanceKm = haversineKm(options.lat, options.lng, row.latitude, row.longitude);
      if (distanceKm < 5) finalScore += 20;
      else if (distanceKm < 20) finalScore += 10;
      else if (distanceKm < 50) finalScore += 4;
    }
    return {
      ...toPublicLocation(row),
      matchVia: via,
      score: finalScore,
      distanceKm,
    };
  });

  withDist.sort((a, b) => b.score - a.score || (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  return withDist.slice(0, limit);
}
