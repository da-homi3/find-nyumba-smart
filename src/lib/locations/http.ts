import { createPublicClient } from "@/lib/api/public-client";
import { getLocationAncestors, getLocationById, getLocationChildren } from "./hierarchy";
import { nearbyLocations, reverseGeocode } from "./reverse-geocode";
import { resolveLocation } from "./resolve";
import { searchLocationsDb } from "./search";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

function parseFloatParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function uuidOk(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** Dispatch /api/locations/* (search, resolve, nearby, reverse, :id, children, ancestors). */
export async function handleLocationsApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabase = createPublicClient();
  const path = url.pathname.replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const rest = parts.slice(2);

  try {
    if (rest.length === 1 && rest[0] === "search") {
      const q = url.searchParams.get("q")?.trim() ?? "";
      if (q.length < 2) return json({ items: [] });
      const items = await searchLocationsDb(supabase, {
        q,
        limit: Number.parseInt(url.searchParams.get("limit") ?? "12", 10) || 12,
        lat: parseFloatParam(url.searchParams.get("lat")),
        lng: parseFloatParam(url.searchParams.get("lng")),
        types: url.searchParams.get("types")?.split(",").filter(Boolean),
        countyId: url.searchParams.get("county_id") ?? undefined,
      });
      // Fire-and-forget autocomplete telemetry (Phase 3 demand analytics).
      void (async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { asLooseDb } = await import("@/lib/db/loose-client");
          const { normalizeLocationName } = await import("@/lib/locations/normalize");
          await asLooseDb(supabaseAdmin).from("location_search_events").insert({
            query: q,
            normalized_query: normalizeLocationName(q),
            selected_location_id: items[0]?.id ?? null,
            result_count: items.length,
            lat: parseFloatParam(url.searchParams.get("lat")) ?? null,
            lng: parseFloatParam(url.searchParams.get("lng")) ?? null,
            source: "web",
          });
        } catch {
          // non-blocking
        }
      })();
      return json({ items });
    }

    if (rest.length === 1 && rest[0] === "resolve") {
      const q = url.searchParams.get("q")?.trim() ?? "";
      if (q.length < 2) return json({ location: null });
      const location = await resolveLocation(supabase, q, {
        lat: parseFloatParam(url.searchParams.get("lat")),
        lng: parseFloatParam(url.searchParams.get("lng")),
      });
      return json({ location });
    }

    if (rest.length === 1 && rest[0] === "nearby") {
      const lat = parseFloatParam(url.searchParams.get("lat"));
      const lng = parseFloatParam(url.searchParams.get("lng"));
      if (lat == null || lng == null) {
        return json({ error: "lat and lng required" }, 400);
      }
      const radiusKm = parseFloatParam(url.searchParams.get("radius_km")) ?? 15;
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20;
      const items = await nearbyLocations(supabase, lat, lng, radiusKm, limit);
      return json({ items });
    }

    if (rest.length === 1 && rest[0] === "reverse") {
      const lat = parseFloatParam(url.searchParams.get("lat"));
      const lng = parseFloatParam(url.searchParams.get("lng"));
      if (lat == null || lng == null) {
        return json({ error: "lat and lng required" }, 400);
      }
      const result = await reverseGeocode(supabase, lat, lng);
      return json(result);
    }

    if (rest.length === 1 && rest[0] && uuidOk(rest[0])) {
      const location = await getLocationById(supabase, rest[0]);
      if (!location) return json({ error: "Not found" }, 404);
      return json({ location });
    }

    if (rest.length === 2 && rest[0] && uuidOk(rest[0]) && rest[1] === "children") {
      const items = await getLocationChildren(supabase, rest[0], {
        types: url.searchParams.get("types")?.split(",").filter(Boolean),
        limit: Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
      });
      return json({ items });
    }

    if (rest.length === 2 && rest[0] && uuidOk(rest[0]) && rest[1] === "ancestors") {
      const items = await getLocationAncestors(supabase, rest[0]);
      return json({ items });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("locations API error:", err);
    return json({ error: err instanceof Error ? err.message : "locations failed" }, 500);
  }
}
