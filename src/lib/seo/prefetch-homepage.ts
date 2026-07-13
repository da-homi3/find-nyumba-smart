import type { QueryClient } from "@tanstack/react-query";
import { fetchProperties } from "@/lib/properties";
import { loadPublicStats } from "@/lib/api/stats.functions";
import {
  loadFeaturedAgencies,
  loadFeaturedTestimonials,
  loadPropertyIntelligenceStats,
} from "@/lib/api/homepage.functions";

/** Enough for featured grid + popular neighborhood counts without over-fetching. */
export const HOMEPAGE_LISTINGS_LIMIT = 32;

/** Prefetch homepage queries during SSR so crawlers receive real listing/stats HTML. */
export async function prefetchHomepageQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["properties", "homepage-featured"],
      queryFn: () => fetchProperties({ limit: HOMEPAGE_LISTINGS_LIMIT }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["public-stats"],
      queryFn: () => loadPublicStats(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["featured-testimonials"],
      queryFn: () => loadFeaturedTestimonials(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["property-intelligence"],
      queryFn: () => loadPropertyIntelligenceStats(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["featured-agencies"],
      queryFn: () => loadFeaturedAgencies(),
    }),
  ]);
}
