import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { LandingHero } from "@/components/landing/LandingHero";
import {
  AgencyLogosSection,
  FeaturedListings,
  PopularNeighborhoods,
  ServiceTeaserRow,
  TrustStrip,
} from "@/components/landing/LandingBrowseSections";
import {
  DownloadApp,
  LandlordBand,
  PropertyIntelSection,
  Testimonials,
  VerifiedSection,
  WhyNyumba,
} from "@/components/landing/LandingMarketingSections";
import { getBrandLogoUrl, getSiteUrl, HOMEPAGE_TITLE } from "@/lib/site";
import { fetchProperties } from "@/lib/properties";
import type { PublicStats } from "@/lib/api/stats.functions";
import { FALLBACK_TESTIMONIALS } from "@/lib/api/homepage-shared";
import {
  fetchFeaturedAgenciesApi,
  fetchFeaturedTestimonialsApi,
  fetchIntelligenceStatsApi,
} from "@/lib/homepage-client";

async function fetchPublicStatsApi(): Promise<PublicStats> {
  const res = await fetch("/api/stats/public", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Stats API ${res.status}`);
  return res.json() as Promise<PublicStats>;
}

export const Route = createFileRoute("/")({
  head: () => {
    const canonical = getSiteUrl();
    const description =
      "Discover verified vacant homes across Nairobi. Map-first search, real reviews, AI guidance — no agent fees, no scams.";
    return {
      meta: [
        { title: HOMEPAGE_TITLE },
        { name: "description", content: description },
        { property: "og:title", content: HOMEPAGE_TITLE },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: HOMEPAGE_TITLE },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: Landing,
});

function Landing() {
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties", "homepage-featured"],
    queryFn: () => fetchProperties({ limit: 50 }),
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
    const now = Date.now();
    const boosted = properties.filter(
      (p) => p.featured_until && new Date(p.featured_until).getTime() > now,
    );
    const pool = boosted.length > 0 ? boosted : properties.filter((p) => p.is_verified);
    return { items: pool.slice(0, 8), isBoosted: boosted.length > 0 };
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
    <div className="min-h-screen bg-(--color-obsidian)">
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
      <ServiceTeaserRow />
      <AgencyLogosSection agencies={featuredAgencies} loading={agenciesLoading} />
      <VerifiedSection />
      <PropertyIntelSection stats={intelligenceStats} loading={intelligenceLoading} />
      <WhyNyumba />
      <Testimonials items={testimonials ?? FALLBACK_TESTIMONIALS} loading={testimonialsLoading} />
      <DownloadApp />
      <LandlordBand />
      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                name: "NyumbaSearch",
                url: getSiteUrl(),
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${getSiteUrl()}/tenant?q={search_term_string}`,
                  },
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "Organization",
                name: "NyumbaSearch",
                url: getSiteUrl(),
                logo: getBrandLogoUrl(),
                contactPoint: {
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  email: "hello@nyumbasearch.com",
                  areaServed: "KE",
                },
              },
              {
                "@type": "RealEstateAgent",
                name: "NyumbaSearch",
                areaServed: "Nairobi, Kenya",
                url: getSiteUrl(),
                description:
                  "Verified vacant homes across Nairobi with map-first search, real reviews, and direct landlord contact.",
              },
            ],
          }),
        }}
      />
    </div>
  );
}
