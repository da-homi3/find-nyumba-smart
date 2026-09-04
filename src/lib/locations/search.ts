import type { LocationsDb } from "./db";
import {
  haversineKm,
  normalizeLocationName,
  parsePlaceQuery,
  editDistance,
  queryLooksLikeRoad,
} from "./normalize";
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

function applyRoadIntentBoost(locationType: string, roadIntent: boolean, score: number): number {
  if (!roadIntent) return score;
  if (locationType === "ROAD") return score + 28;
  if (["LOCALITY", "TOWN", "CITY", "CONSTITUENCY"].includes(locationType)) return score - 30;
  return score;
}

function upsertHit(
  byId: Map<string, { row: LocationRow; score: number; via: LocationSearchHit["matchVia"] }>,
  row: LocationRow,
  score: number,
  via: LocationSearchHit["matchVia"],
) {
  const prev = byId.get(row.id);
  if (!prev || score > prev.score) byId.set(row.id, { row, score, via });
}

async function collectQueryHits(
  supabase: LocationsDb,
  query: string,
  types: string[],
  countyId: string | undefined,
  altPenalty: number,
  byId: Map<string, { row: LocationRow; score: number; via: LocationSearchHit["matchVia"] }>,
) {
  const roadIntent = queryLooksLikeRoad(query);

  let nameQuery = supabase
    .from("locations")
    .select(SELECT_COLS)
    .eq("is_active", true)
    .in("location_type", types)
    .ilike("normalized_name", `%${query}%`)
    .limit(60);

  if (countyId) {
    nameQuery = nameQuery.eq("parent_id", countyId);
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

  for (const raw of nameRows ?? []) {
    const row = raw as unknown as LocationRow;
    const { score, via } = scoreNameMatch(row.normalized_name, query);
    if (score <= 0) continue;
    let boosted =
      Math.max(0, score - altPenalty) + typeBoost(row.location_type) + (row.is_official ? 5 : 0);
    boosted = applyRoadIntentBoost(row.location_type, roadIntent, boosted);
    upsertHit(byId, row, boosted, via);
  }

  for (const alias of aliasRows ?? []) {
    const aliasRow = alias as unknown as {
      normalized_alias?: string;
      locations: (LocationRow & { is_active: boolean }) | (LocationRow & { is_active: boolean })[];
    };
    const locRaw = aliasRow.locations;
    const loc = Array.isArray(locRaw) ? locRaw[0] : locRaw;
    if (!loc?.is_active) continue;
    if (!types.includes(loc.location_type)) continue;
    const aliasNorm = String(aliasRow.normalized_alias ?? "");
    const { score } = scoreNameMatch(aliasNorm, query);
    if (score <= 0) continue;
    let boosted = Math.max(0, score - altPenalty) + typeBoost(loc.location_type) + 8;
    boosted = applyRoadIntentBoost(loc.location_type, roadIntent, boosted);
    upsertHit(byId, loc, boosted, "alias");
  }
}

type ParentLoc = {
  id: string;
  parent_id: string | null;
  normalized_name: string;
  name: string;
};

async function filterHitsByCountyHint(
  supabase: LocationsDb,
  hits: { row: LocationRow; score: number; via: LocationSearchHit["matchVia"] }[],
  countyHint: string,
) {
  const hint = normalizeLocationName(countyHint);
  const matchesHint = (normalizedName: string, name: string) => {
    const pn = normalizeLocationName(normalizedName || name);
    return pn.includes(hint) || hint.includes(pn);
  };
  const parentCache = new Map<string, ParentLoc>();
  let frontier = [...new Set(hits.map((h) => h.row.parent_id).filter(Boolean))] as string[];
  while (frontier.length) {
    const { data: parents } = await supabase
      .from("locations")
      .select("id,parent_id,normalized_name,name")
      .in("id", frontier);
    const next: string[] = [];
    for (const p of parents ?? []) {
      const id = p.id as string;
      parentCache.set(id, {
        id,
        parent_id: (p.parent_id as string | null) ?? null,
        normalized_name: String(p.normalized_name ?? ""),
        name: String(p.name ?? ""),
      });
      if (p.parent_id && !parentCache.has(p.parent_id as string)) {
        next.push(p.parent_id as string);
      }
    }
    frontier = [...new Set(next)];
  }
  return hits.filter((h) => {
    if (matchesHint(h.row.normalized_name, h.row.name)) return true;
    let pid = h.row.parent_id;
    const seen = new Set<string>();
    while (pid && !seen.has(pid)) {
      seen.add(pid);
      const p = parentCache.get(pid);
      if (!p) return false;
      if (matchesHint(p.normalized_name, p.name)) return true;
      pid = p.parent_id;
    }
    return false;
  });
}

function toRankedHits(
  hits: { row: LocationRow; score: number; via: LocationSearchHit["matchVia"] }[],
  options: LocationSearchOptions,
  limit: number,
): LocationSearchHit[] {
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

export async function searchLocationsDb(
  supabase: LocationsDb,
  options: LocationSearchOptions,
): Promise<LocationSearchHit[]> {
  const { place, countyHint, alternates } = parsePlaceQuery(options.q);
  const queries = [
    normalizeLocationName(place),
    ...alternates.map((a) => normalizeLocationName(a)),
  ].filter((q) => q.length >= 2);
  if (!queries.length) return [];

  const limit = Math.min(Math.max(options.limit ?? 12, 1), 40);
  const types = options.types?.length ? options.types : [...SEARCHABLE_TYPES];

  const byId = new Map<
    string,
    { row: LocationRow; score: number; via: LocationSearchHit["matchVia"] }
  >();

  for (let qi = 0; qi < queries.length; qi += 1) {
    const query = queries[qi]!;
    await collectQueryHits(supabase, query, types, options.countyId, qi === 0 ? 0 : 12, byId);
  }

  let hits = [...byId.values()];
  if (countyHint) {
    hits = await filterHitsByCountyHint(supabase, hits, countyHint);
  }
  return toRankedHits(hits, options, limit);
}
