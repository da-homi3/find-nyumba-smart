import type { LocationsDb } from "./db";
import { searchLocationsDb } from "./search";
import { getLocationAncestors } from "./hierarchy";
import type { ResolvedLocation } from "./types";

export async function resolveLocation(
  supabase: LocationsDb,
  q: string,
  options?: { lat?: number; lng?: number },
): Promise<ResolvedLocation | null> {
  const hits = await searchLocationsDb(supabase, {
    q,
    limit: 8,
    lat: options?.lat,
    lng: options?.lng,
  });
  if (!hits.length) return null;

  const best = hits[0]!;
  const second = hits[1];
  const ambiguous =
    Boolean(second) &&
    second!.score >= best.score - 8 &&
    second!.name.toLowerCase() !== best.name.toLowerCase();

  let chosen = best;
  if (ambiguous) {
    const roadIntent = /\b(road|rd|way|highway|hwy|bypass|link)\b/i.test(q);
    if (roadIntent) {
      const road = hits.find((h) => h.type === "ROAD");
      if (road && road.score >= best.score - 20) chosen = road;
    } else {
      const urban = hits.find((h) =>
        ["NEIGHBOURHOOD", "LOCALITY", "ESTATE", "TOWN"].includes(h.type),
      );
      if (urban && urban.score >= best.score - 12) chosen = urban;
    }
  }

  const ancestors = await getLocationAncestors(supabase, chosen.id);
  const matchConfidence = Math.min(100, Math.round(chosen.score));
  const stillAmbiguous =
    Boolean(second) &&
    second!.score >= chosen.score - 8 &&
    second!.name.toLowerCase() !== chosen.name.toLowerCase() &&
    second!.id !== chosen.id;
  return {
    ...chosen,
    ancestors,
    matchConfidence,
    needsReview: stillAmbiguous || matchConfidence < 70,
  };
}
