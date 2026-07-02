import type { PropertySearchFilters } from "@/lib/properties";
import type { ListingsResult } from "@/lib/api/listings-core";
import { reportClientError } from "@/lib/client-error-report";

const FETCH_TIMEOUT_MS = 25_000;

function buildListingsUrl(filters?: PropertySearchFilters): string {
  const params = new URLSearchParams();
  const f = filters ?? {};
  if (f.limit != null) params.set("limit", String(f.limit));
  if (f.offset != null) params.set("offset", String(f.offset));
  if (f.query) params.set("q", f.query);
  if (f.neighborhood && f.neighborhood !== "All") params.set("neighborhood", f.neighborhood);
  if (f.propertyType) params.set("type", f.propertyType);
  if (f.minRent != null) params.set("minRent", String(f.minRent));
  if (f.maxRent != null) params.set("maxRent", String(f.maxRent));
  if (f.verifiedOnly) params.set("verifiedOnly", "1");
  if (f.minBedrooms != null) params.set("minBedrooms", String(f.minBedrooms));
  if (f.sortBy) params.set("sortBy", f.sortBy);
  const qs = params.toString();
  if (!qs) return "/api/listings";
  return `/api/listings?${qs}`;
}

/** Browser-safe listings fetch via REST (avoids server-fn POST hangs in production). */
export async function fetchListingsApi(filters?: PropertySearchFilters): Promise<ListingsResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(buildListingsUrl(filters), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let message = `Listings API ${res.status}`;
      if (body) message += `: ${body.slice(0, 120)}`;
      reportClientError({ source: "listings-api", message, filters });
      throw new Error(message);
    }

    const result: ListingsResult = await res.json();
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const message = "Listings request timed out — please try again.";
      reportClientError({ source: "listings-api", message, filters });
      throw new Error(message);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
