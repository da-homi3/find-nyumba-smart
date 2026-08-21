import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/api/public-client";
import { asLooseDb } from "@/lib/db/loose-client";
import { getLocationAncestors, getLocationById } from "@/lib/locations/hierarchy";
import { resolveLocation } from "@/lib/locations/resolve";

/**
 * Resolve neighborhood (+ optional locationId) onto property location FKs.
 * Preserves free-text neighborhood; never invents places.
 */
export async function attachPropertyLocationFks(
  admin: SupabaseClient,
  propertyId: string,
  neighborhood: string,
  locationId?: string | null,
): Promise<void> {
  const place = neighborhood.trim();
  if (!place && !locationId) return;

  try {
    const publicDb = createPublicClient();
    const db = asLooseDb(admin);

    let resolvedId = locationId ?? null;
    let confidence = locationId ? 90 : 0;
    let needsReview = !locationId;

    if (!resolvedId && place.length >= 2) {
      const hit = await resolveLocation(publicDb, place);
      if (!hit) return;
      resolvedId = hit.id;
      confidence = hit.matchConfidence;
      needsReview = hit.needsReview;
    }
    if (!resolvedId) return;

    const self = await getLocationById(publicDb, resolvedId);
    const ancestors = await getLocationAncestors(publicDb, resolvedId);
    const chain = self ? [self, ...ancestors] : ancestors;
    const county = chain.find((a) => a.type === "COUNTY");
    const constituency = chain.find((a) => a.type === "CONSTITUENCY");
    const ward = chain.find((a) => a.type === "WARD");

    await db
      .from("properties")
      .update({
        location_id: resolvedId,
        county_location_id: county?.id ?? null,
        constituency_location_id: constituency?.id ?? null,
        ward_location_id: ward?.id ?? null,
        location_match_confidence: confidence,
        location_needs_review: needsReview,
      })
      .eq("id", propertyId);
  } catch (err) {
    console.warn("[attachPropertyLocationFks]", err);
  }
}
