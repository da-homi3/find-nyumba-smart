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
export const HOMEPAGE_LISTINGS_LIMIT = 24;

/** Prefetch above-fold homepage data during SSR. Below-fold queries warm in parallel without blocking TTFB. */
export async function prefetchHomepageQueries(queryClient: QueryClient): Promise<{
  providerCounts: Awaited<ReturnType<typeof getProviderCategoryCounts>>;
}> {
  const critical = Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["properties", "homepage-featured"],
      queryFn: () => fetchProperties({ limit: HOMEPAGE_LISTINGS_LIMIT, sortBy: "newest" }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["public-stats"],
      queryFn: () => loadPublicStats(),
    }),
    getProviderCategoryCounts(),
  ]);

  // Fire-and-forget: hydrate RQ for client without delaying first HTML byte.
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

  const [, , providerCounts] = await critical;
  return { providerCounts };
}
