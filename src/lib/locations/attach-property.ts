import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/api/public-client";
import { asLooseDb } from "@/lib/db/loose-client";
import { getLocationAncestors, getLocationById } from "@/lib/locations/hierarchy";
import { resolveLocation } from "@/lib/locations/resolve";
import { reverseGeocode } from "@/lib/locations/reverse-geocode";

export type AttachPropertyLocationOptions = {
  locationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Resolve neighborhood (+ optional locationId / pin) onto property location FKs.
 * Preserves free-text neighborhood; never invents places.
 * Text resolve first; if that fails and a pin exists, use PIP / nearest centroid.
 */
export async function attachPropertyLocationFks(
  admin: SupabaseClient,
  propertyId: string,
  neighborhood: string,
  locationIdOrOpts?: string | null | AttachPropertyLocationOptions,
): Promise<void> {
  const opts: AttachPropertyLocationOptions =
    locationIdOrOpts != null && typeof locationIdOrOpts === "object"
      ? locationIdOrOpts
      : { locationId: (locationIdOrOpts as string | null | undefined) ?? null };

  const place = neighborhood.trim();
  if (!place && !opts.locationId) return;

  try {
    const publicDb = createPublicClient();
    const db = asLooseDb(admin);

    let resolvedId = opts.locationId ?? null;
    let confidence = opts.locationId ? 90 : 0;
    let needsReview = !opts.locationId;
    let method: "text" | "explicit" | "polygon" | "nearest_centroid" | "none" = opts.locationId
      ? "explicit"
      : "none";

    if (!resolvedId && place.length >= 2) {
      const hit = await resolveLocation(publicDb, place, {
        lat: opts.latitude ?? undefined,
        lng: opts.longitude ?? undefined,
      });
      if (hit) {
        resolvedId = hit.id;
        confidence = hit.matchConfidence;
        needsReview = hit.needsReview;
        method = "text";
      }
    }

    if (
      !resolvedId &&
      opts.latitude != null &&
      opts.longitude != null &&
      Number.isFinite(opts.latitude) &&
      Number.isFinite(opts.longitude)
    ) {
      const geo = await reverseGeocode(publicDb, opts.latitude, opts.longitude);
      const pinHit = geo.locality ?? geo.ward ?? geo.constituency ?? geo.county;
      if (pinHit && geo.confidence >= 55) {
        resolvedId = pinHit.id;
        confidence = Math.min(geo.confidence, geo.method === "polygon" ? 88 : 65);
        needsReview = geo.method !== "polygon" || confidence < 80;
        method = geo.method === "none" ? "none" : geo.method;
      }
    }

    if (!resolvedId) return;

    // High-confidence exact text matches shouldn't clutter the review queue.
    if (method === "text" && confidence >= 85 && !needsReview) {
      needsReview = false;
    } else if (method === "text" && confidence >= 90) {
      needsReview = false;
    } else if (method === "explicit") {
      needsReview = false;
    } else if (method === "polygon" && confidence >= 80) {
      needsReview = false;
    }

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

    const { recountLocationInventory } = await import("@/lib/locations/inventory");
    await recountLocationInventory(
      admin,
      [resolvedId, county?.id, constituency?.id, ward?.id].filter(Boolean) as string[],
    );
  } catch (err) {
    console.warn("[attachPropertyLocationFks]", err);
  }
}
