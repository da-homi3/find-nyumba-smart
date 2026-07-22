import type { QueryClient } from "@tanstack/react-query";
import { fetchProperties } from "@/lib/properties";
import { loadPublicStats } from "@/lib/api/stats.functions";
import {
  loadFeaturedAgencies,
  loadFeaturedTestimonials,
  loadPropertyIntelligenceStats,
} from "@/lib/api/homepage.functions";
import { getProviderCategoryCounts } from "@/lib/api/service-provider.functions";

/** Enough for featured grid + popular neighborhood counts without over-fetching. */
export const HOMEPAGE_LISTINGS_LIMIT = 16;

/** Prefetch above-fold homepage listings during SSR. Everything else warms without blocking TTFB. */
export async function prefetchHomepageQueries(queryClient: QueryClient): Promise<{
  providerCounts: Awaited<ReturnType<typeof getProviderCategoryCounts>>;
}> {
  await queryClient.prefetchQuery({
    queryKey: ["properties", "homepage-featured"],
    queryFn: () => fetchProperties({ limit: HOMEPAGE_LISTINGS_LIMIT, sortBy: "newest" }),
  });

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
    const cached = await cacheGet<Awaited<ReturnType<typeof getProviderCategoryCounts>>>(
      "provider_category_counts_v1",
    );
    if (cached) {
      void getProviderCategoryCounts();
      return { providerCounts: cached };
    }
  } catch {
    // ignore cache miss path
  }

  void getProviderCategoryCounts();
  return { providerCounts: {} as Awaited<ReturnType<typeof getProviderCategoryCounts>> };
}
