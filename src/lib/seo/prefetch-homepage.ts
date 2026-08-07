import type { QueryClient } from "@tanstack/react-query";
import { fetchProperties } from "@/lib/properties";
import { loadPublicStats } from "@/lib/api/stats.functions";
import {
  loadFeaturedAgencies,
  loadFeaturedTestimonials,
  loadPropertyIntelligenceStats,
} from "@/lib/api/homepage.functions";

/** Enough for featured grid + popular neighborhood counts without over-fetching. */
export const HOMEPAGE_LISTINGS_LIMIT = 12;

const HOMEPAGE_PREFETCH_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[homepage] ${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

type ProviderCounts = Record<string, number>;

/** Prefetch above-fold homepage listings during SSR. Everything else warms without blocking TTFB. */
export async function prefetchHomepageQueries(queryClient: QueryClient): Promise<{
  providerCounts: ProviderCounts;
}> {
  try {
    await withTimeout(
      queryClient.prefetchQuery({
        queryKey: ["properties", "homepage-featured"],
        queryFn: () => fetchProperties({ limit: HOMEPAGE_LISTINGS_LIMIT, sortBy: "newest" }),
      }),
      HOMEPAGE_PREFETCH_TIMEOUT_MS,
      "featured listings",
    );
  } catch (err) {
    // Fail open — client useQuery will refill; never hang the Worker on homepage SSR.
    console.warn("[homepage] featured prefetch skipped", err);
  }

  // Warm secondary queries without awaiting (and without createServerFn self-fetch).
  void queryClient.prefetchQuery({
    queryKey: ["public-stats"],
    queryFn: () => loadPublicStats(),
  });
  void queryClient.prefetchQuery({
    queryKey: ["featured-testimonials"],
    queryFn: () => loadFeaturedTestimonials(),
  });
  void queryClient.prefetchQuery({
    queryKey: ["property-intelligence"],
    queryFn: () => loadPropertyIntelligenceStats(),
  });
  void queryClient.prefetchQuery({
    queryKey: ["featured-agencies"],
    queryFn: () => loadFeaturedAgencies(),
  });

  // Prefer KV-warm counts; never block first paint on a cold provider scan.
  try {
    const { cacheGet } = await import("@/lib/cache/manager");
    const cached = await withTimeout(
      cacheGet<ProviderCounts>("provider_category_counts_v1"),
      800,
      "provider counts cache",
    );
    if (cached) {
      return { providerCounts: cached };
    }
  } catch {
    // ignore cache miss / timeout path
  }

  return { providerCounts: {} };
}
