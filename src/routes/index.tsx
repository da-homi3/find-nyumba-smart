import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { LandingHero } from "@/components/landing/LandingHero";
import {
  AgencyLogosSection,
  FeaturedListings,
  PopularNeighborhoods,
  ServiceTeaserRow,
  TrustStrip,
} from "@/components/landing/LandingBrowseSections";
import { HOMEPAGE_DESCRIPTION, HOMEPAGE_TITLE } from "@/lib/site";
import { fetchProperties } from "@/lib/properties";
import type { PublicStats } from "@/lib/api/stats.functions";
import { FALLBACK_TESTIMONIALS } from "@/lib/api/homepage-shared";
import {
  fetchFeaturedAgenciesApi,
  fetchFeaturedTestimonialsApi,
  fetchIntelligenceStatsApi,
} from "@/lib/homepage-client";
import { prefetchHomepageQueries, HOMEPAGE_LISTINGS_LIMIT } from "@/lib/seo/prefetch-homepage";
import { buildPageHead } from "@/lib/seo/head";
import { buildHomepageJsonLd } from "@/lib/seo/brand-entity";

const LandingMarketingBelowFold = lazy(() =>
  import("@/components/landing/LandingMarketingBelowFold").then((m) => ({
    default: m.LandingMarketingBelowFold,
  })),
);

async function fetchPublicStatsApi(): Promise<PublicStats> {
  const res = await fetch("/api/stats/public", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Stats API ${res.status}`);
  return res.json() as Promise<PublicStats>;
}

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const { providerCounts } = await prefetchHomepageQueries(context.queryClient);
    return { providerCounts };
  },
  head: () => {
    const description = HOMEPAGE_DESCRIPTION;
    return buildPageHead({
      title: HOMEPAGE_TITLE,
      description,
      path: "",
      jsonLd: buildHomepageJsonLd(),
    });
  },
  component: Landing,
});

function Landing() {
  const { providerCounts } = Route.useLoaderData();
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties", "homepage-featured"],
    queryFn: () =>
      fetchProperties({ limit: HOMEPAGE_LISTINGS_LIMIT, sortBy: "newest" }),
    staleTime: 60_000,
  });

  const { data: publicStats, isLoading: statsLoading } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => fetchPublicStatsApi(),
    staleTime: 120_000,
  });

  const { data: testimonials, isLoading: testimonialsLoading } = useQuery({
    queryKey: ["featured-testimonials"],
    queryFn: () => fetchFeaturedTestimonialsApi(),
    staleTime: 3_600_000,
  });

  const { data: intelligenceStats, isLoading: intelligenceLoading } = useQuery({
    queryKey: ["property-intelligence"],
    queryFn: () => fetchIntelligenceStatsApi(),
    staleTime: 300_000,
  });

  const { data: featuredAgencies = [], isLoading: agenciesLoading } = useQuery({
    queryKey: ["featured-agencies"],
    queryFn: () => fetchFeaturedAgenciesApi(),
    staleTime: 600_000,
  });

  const featured = useMemo(() => {
    const newest = [...properties].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    return { items: newest.slice(0, 8), isBoosted: false };
  }, [properties]);

  const popularNeighborhoods = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of properties) {
      counts.set(p.neighborhood, (counts.get(p.neighborhood) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [properties]);

  const minRentByHood = useMemo(() => {
    const mins = new Map<string, number>();
    for (const p of properties) {
      if (!p.neighborhood || !p.rent_kes) continue;
      const prev = mins.get(p.neighborhood);
      if (prev === undefined || p.rent_kes < prev) mins.set(p.neighborhood, p.rent_kes);
    }
    return Object.fromEntries(mins);
  }, [properties]);

  const stats = useMemo(() => {
    if (publicStats) {
      return {
        verifiedCount: publicStats.verifiedListings,
        hoods: publicStats.neighborhoodCount,
        activeListings: publicStats.activeListings,
      };
    }
    const verifiedCount = properties.filter((p) => p.is_verified).length;
    const hoods = new Set(properties.map((p) => p.neighborhood)).size;
    return { verifiedCount, hoods, activeListings: properties.length };
  }, [properties, publicStats]);

  return (
    <div className="min-h-screen overflow-x-clip bg-(--color-obsidian)">
      <SiteNav variant="hero" />
      <LandingHero verifiedCount={stats.verifiedCount} hoodCount={stats.hoods} />
      <TrustStrip
        ready={!statsLoading}
        stats={{
          verifiedHomes: stats.verifiedCount || stats.activeListings,
          noAgentFeesPct: publicStats?.noAgentFeesPct,
          avgResponseHours: publicStats?.avgResponseHours,
          tenantRating: publicStats?.tenantRating,
        }}
      />
      <FeaturedListings
        featured={featured.items}
        isBoosted={featured.isBoosted}
        loading={propertiesLoading}
      />
      <PopularNeighborhoods
        hoods={popularNeighborhoods}
        minRentByHood={minRentByHood}
        loading={propertiesLoading}
      />
      <ServiceTeaserRow counts={providerCounts} />
      <AgencyLogosSection agencies={featuredAgencies} loading={agenciesLoading} />
      <Suspense fallback={null}>
        <LandingMarketingBelowFold
          intelligenceStats={intelligenceStats}
          intelligenceLoading={intelligenceLoading}
          testimonials={testimonials ?? FALLBACK_TESTIMONIALS}
          testimonialsLoading={testimonialsLoading}
        />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
