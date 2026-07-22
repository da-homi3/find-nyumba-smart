import type { PropertySearchFilters } from "@/lib/properties";
import type { ListingsResult } from "@/lib/api/listings-core";
import { reportClientError } from "@/lib/client-error-report";

const FETCH_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 450;

type FetchOk = { ok: true; result: ListingsResult };
type FetchFail = { ok: false; status: number; message: string };
type FetchAttempt = FetchOk | FetchFail;

function shouldRetryWorker(status: number, body: string): boolean {
  if (status >= 500) return true;
  return /<!doctype html>|<html/i.test(body);
}

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function throwRateLimited(filters?: PropertySearchFilters): never {
  const message = "Too many requests — please wait a moment and try again.";
  reportClientError({ source: "listings-api", message, filters });
  throw new Error(message);
}

function throwListingsError(filters: PropertySearchFilters | undefined, message: string): never {
  reportClientError({ source: "listings-api", message, filters });
  throw new Error(message);
}

async function fetchListingsDirectFallback(
  filters?: PropertySearchFilters,
  reason?: string,
): Promise<ListingsResult> {
  const [{ queryListingsDirect }, { supabase }] = await Promise.all([
    import("@/lib/api/listings-core"),
    import("@/integrations/supabase/client"),
  ]);
  if (reason) {
    reportClientError({
      source: "listings-api-fallback",
      message: reason,
      filters,
    });
  }
  return queryListingsDirect(filters, supabase);
}

async function fallbackOrThrow(
  filters: PropertySearchFilters | undefined,
  message: string,
): Promise<ListingsResult> {
  try {
    return await fetchListingsDirectFallback(filters, message);
  } catch {
    throwListingsError(filters, message);
  }
}

function appendFilterParams(params: URLSearchParams, f: PropertySearchFilters) {
  if (f.limit != null) params.set("limit", String(Math.min(f.limit, 300)));
  if (f.offset != null) params.set("offset", String(f.offset));
  if (f.query) params.set("q", f.query);
  if (f.neighborhood && f.neighborhood !== "All") params.set("neighborhood", f.neighborhood);
  if (f.propertyType) params.set("type", f.propertyType);
  if (f.pricingMode) params.set("pricingMode", f.pricingMode);
  if (f.minRent != null) params.set("minRent", String(f.minRent));
  if (f.maxRent != null) params.set("maxRent", String(f.maxRent));
  if (f.verifiedOnly) params.set("verifiedOnly", "1");
  if (f.minBedrooms != null) params.set("minBedrooms", String(f.minBedrooms));
  if (f.sortBy) params.set("sortBy", f.sortBy);
  if (f.originLat != null) params.set("originLat", String(f.originLat));
  if (f.originLng != null) params.set("originLng", String(f.originLng));
}

function buildListingsUrl(filters?: PropertySearchFilters): string {
  const params = new URLSearchParams();
  appendFilterParams(params, filters ?? {});
  const qs = params.toString();
  return qs ? `/api/listings?${qs}` : "/api/listings";
}

async function fetchListingsOnce(
  filters: PropertySearchFilters | undefined,
  signal: AbortSignal,
): Promise<FetchAttempt> {
  const res = await fetch(buildListingsUrl(filters), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 160);
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed?.error) detail = parsed.error;
    } catch {
      // keep raw body slice
    }
    const message = detail
      ? `Listings API ${res.status}: ${detail}`
      : `Listings API ${res.status}`;
    return { ok: false, status: res.status, message };
  }

  const result: ListingsResult = await res.json();
  return { ok: true, result };
}

async function fetchWithWorkerRetry(
  filters: PropertySearchFilters | undefined,
  signal: AbortSignal,
): Promise<FetchAttempt> {
  const first = await fetchListingsOnce(filters, signal);
  if (first.ok || first.status === 429) return first;
  if (!shouldRetryWorker(first.status, first.message)) return first;

  await sleep(RETRY_DELAY_MS);
  return fetchListingsOnce(filters, signal);
}

async function resolveFailedAttempt(
  filters: PropertySearchFilters | undefined,
  attempt: FetchFail,
): Promise<ListingsResult> {
  if (attempt.status === 429) {
    reportClientError({ source: "listings-api", message: attempt.message, filters });
    throwRateLimited(filters);
  }
  if (shouldRetryWorker(attempt.status, attempt.message)) {
    return fallbackOrThrow(filters, attempt.message);
  }
  throwListingsError(filters, attempt.message);
}

/** Browser-safe listings fetch via REST (avoids server-fn POST hangs in production). */
export async function fetchListingsApi(filters?: PropertySearchFilters): Promise<ListingsResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const attempt = await fetchWithWorkerRetry(filters, controller.signal);
    if (attempt.ok) return attempt.result;
    return resolveFailedAttempt(filters, attempt);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return fallbackOrThrow(filters, "Listings request timed out — please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
