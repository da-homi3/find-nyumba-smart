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
import { getSiteUrl } from "@/lib/site";
import { fetchProperties } from "@/lib/properties";
import { getPublicStats } from "@/lib/api/stats.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NyumbaSearch — Find Verified Homes in Nairobi, Smarter" },
      {
        name: "description",
        content:
          "Discover verified vacant homes across Nairobi. Map-first search, real reviews, AI guidance — no agent fees, no scams.",
      },
      { property: "og:title", content: "NyumbaSearch — Verified homes in Nairobi" },
      {
        property: "og:description",
        content:
          "Skip the agents. Map-first search across thousands of verified vacant homes in Nairobi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { rel: "canonical", href: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Landing() {
  const { data: properties = [] } = useQuery({
    queryKey: ["properties", "homepage-featured"],
    queryFn: () => fetchProperties(),
    staleTime: 60_000,
  });

  const { data: publicStats } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => getPublicStats(),
    staleTime: 120_000,
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
    <div className="min-h-screen bg-background">
      <SiteNav variant="hero" />
      <LandingHero verifiedCount={stats.verifiedCount} hoodCount={stats.hoods} />
      <TrustStrip />
      <FeaturedListings featured={featured.items} isBoosted={featured.isBoosted} />
      <PopularNeighborhoods hoods={popularNeighborhoods} />
      <ServiceTeaserRow />
      <AgencyLogosSection />
      <VerifiedSection />
      <PropertyIntelSection />
      <WhyNyumba />
      <Testimonials />
      <DownloadApp />
      <LandlordBand />
      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            name: "NyumbaSearch",
            areaServed: "Nairobi, Kenya",
            url: getSiteUrl(),
            description:
              "Verified vacant homes across Nairobi with map-first search, real reviews, and direct landlord contact.",
          }),
        }}
      />
    </div>
  );
}
