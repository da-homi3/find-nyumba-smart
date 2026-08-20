import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";

function parseFloatParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Mobile BFF location intelligence (Phase 2).
 * Public-read endpoints; bearer optional for future personalization.
 */
export async function tryHandleWave22(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (method !== "GET") return null;

  // Allow anonymous browse for location search (same as web /api/locations).
  if (rest === "/locations/search") {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return mobileJson({ apiVersion: "v1", items: [] });
    const { createPublicClient } = await import("@/lib/api/public-client");
    const { searchLocationsDb } = await import("@/lib/locations/search");
    const items = await searchLocationsDb(createPublicClient(), {
      q,
      limit: Number.parseInt(url.searchParams.get("limit") ?? "12", 10) || 12,
      lat: parseFloatParam(url.searchParams.get("lat")),
      lng: parseFloatParam(url.searchParams.get("lng")),
      types: url.searchParams.get("types")?.split(",").filter(Boolean),
    });
    return mobileJson({ apiVersion: "v1", items });
  }

  if (rest === "/locations/resolve") {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return mobileJson({ apiVersion: "v1", location: null });
    const { createPublicClient } = await import("@/lib/api/public-client");
    const { resolveLocation } = await import("@/lib/locations/resolve");
    const location = await resolveLocation(createPublicClient(), q, {
      lat: parseFloatParam(url.searchParams.get("lat")),
      lng: parseFloatParam(url.searchParams.get("lng")),
    });
    return mobileJson({ apiVersion: "v1", location });
  }

  if (rest === "/locations/reverse") {
    const url = new URL(req.url);
    const lat = parseFloatParam(url.searchParams.get("lat"));
    const lng = parseFloatParam(url.searchParams.get("lng"));
    if (lat == null || lng == null) {
      return mobileError("lat and lng required", "VALIDATION", 400);
    }
    const { createPublicClient } = await import("@/lib/api/public-client");
    const { reverseGeocode } = await import("@/lib/locations/reverse-geocode");
    const result = await reverseGeocode(createPublicClient(), lat, lng);
    return mobileJson({ apiVersion: "v1", ...result });
  }

  if (rest === "/locations/nearby") {
    const url = new URL(req.url);
    const lat = parseFloatParam(url.searchParams.get("lat"));
    const lng = parseFloatParam(url.searchParams.get("lng"));
    if (lat == null || lng == null) {
      return mobileError("lat and lng required", "VALIDATION", 400);
    }
    const { createPublicClient } = await import("@/lib/api/public-client");
    const { nearbyLocations } = await import("@/lib/locations/reverse-geocode");
    const radiusKm = parseFloatParam(url.searchParams.get("radius_km")) ?? 15;
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20;
    const items = await nearbyLocations(createPublicClient(), lat, lng, radiusKm, limit);
    return mobileJson({ apiVersion: "v1", items });
  }

  // Landlord resolve suggestions — authenticated
  if (rest === "/locations/suggest-neighborhood") {
    const auth = await requireMobileBearer(req);
    if (auth instanceof Response) return auth;
    const url = new URL(req.url);
    const lat = parseFloatParam(url.searchParams.get("lat"));
    const lng = parseFloatParam(url.searchParams.get("lng"));
    const q = url.searchParams.get("q")?.trim();
    const { createPublicClient } = await import("@/lib/api/public-client");
    const supabase = createPublicClient();
    if (q && q.length >= 2) {
      const { resolveLocation } = await import("@/lib/locations/resolve");
      const location = await resolveLocation(supabase, q, { lat, lng });
      return mobileJson({
        apiVersion: "v1",
        suggestion: location
          ? {
              name: location.name,
              locationId: location.id,
              type: location.type,
              confidence: location.matchConfidence,
              needsReview: location.needsReview,
              lat: location.lat,
              lng: location.lng,
            }
          : null,
      });
    }
    if (lat != null && lng != null) {
      const { reverseGeocode } = await import("@/lib/locations/reverse-geocode");
      const rev = await reverseGeocode(supabase, lat, lng);
      const pick = rev.locality ?? rev.ward ?? rev.constituency;
      return mobileJson({
        apiVersion: "v1",
        suggestion: pick
          ? {
              name: pick.name,
              locationId: pick.id,
              type: pick.type,
              confidence: rev.confidence,
              needsReview: rev.method !== "polygon",
              lat: pick.lat,
              lng: pick.lng,
              county: rev.county?.name ?? null,
            }
          : null,
      });
    }
    return mobileError("q or lat/lng required", "VALIDATION", 400);
  }

  return null;
}
