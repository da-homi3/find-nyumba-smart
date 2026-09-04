import { mobileError, mobileJson } from "@/lib/api/mobile/v1/auth";
import { mergeNlSearchIntoFilters, parseNlSearchQuery } from "@/lib/search/nl-query-parser";
import type { PropertySearchFilters } from "@/lib/properties";

function parseBoundedInt(raw: string | null, fallback: number): number {
  const n = Number(raw ?? String(fallback));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function tryHandleWave26(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const upper = method.toUpperCase();
  if (rest !== "/search/nl" || upper !== "GET") return null;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return mobileError("q must be at least 3 characters", "VALIDATION", 400);
  }

  const parsed = parseNlSearchQuery(q);
  const includeListings = url.searchParams.get("includeListings") === "1";

  if (!includeListings) {
    return mobileJson({
      apiVersion: "v1",
      query: q,
      filters: parsed.filters,
      remainingQuery: parsed.remainingQuery ?? null,
      hints: parsed.hints,
    });
  }

  try {
    const { queryListings } = await import("@/lib/api/listings-core");
    const filters: PropertySearchFilters = mergeNlSearchIntoFilters(
      {
        limit: parseBoundedInt(url.searchParams.get("limit"), 20),
        offset: parseBoundedInt(url.searchParams.get("offset"), 0),
        sortBy: "newest",
      },
      parsed,
    );
    const result = await queryListings(filters);
    return mobileJson({
      apiVersion: "v1",
      query: q,
      filters: parsed.filters,
      remainingQuery: parsed.remainingQuery ?? null,
      hints: parsed.hints,
      listings: result,
    });
  } catch (err) {
    console.error("[wave26] nl search listings", err);
    return mobileError("Could not search listings", "SEARCH_ERROR", 500);
  }
}
