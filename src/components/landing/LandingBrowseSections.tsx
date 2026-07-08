import { Link } from "@tanstack/react-router";
import type { Property } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";
import { AdUnit } from "@/components/AdUnit";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { ServiceCategoryIcon } from "@/components/services/ServiceCategoryIcon";
import { HOOD_META } from "@/components/landing/hood-meta";
import { AnimatedStat } from "@/components/motion/AnimatedStat";
import { Star } from "lucide-react";
import { NeighborhoodCard3D } from "@/components/landing/NeighborhoodCard3D";
import {
  ScrollReveal,
  ScrollRevealStagger,
  ScrollRevealItem,
} from "@/components/motion/ScrollReveal";
import { StatsSkeleton } from "@/components/skeletons/StatsSkeleton";
import { NeighborhoodGridSkeleton } from "@/components/skeletons/NeighborhoodGridSkeleton";
import { FEATURED_SKELETON_KEYS } from "@/components/skeletons/skeleton-keys";
import { ListingCardSkeleton } from "@/components/skeletons/ListingCardSkeleton";
import type { FeaturedAgency } from "@/lib/api/homepage-shared";

export type TrustStripStats = {
  verifiedHomes: number;
  noAgentFeesPct: number;
  avgResponseHours: number;
  tenantRating: number;
};

const FALLBACK_TRUST_STATS: TrustStripStats = {
  verifiedHomes: 24,
  noAgentFeesPct: 98,
  avgResponseHours: 24,
  tenantRating: 4.7,
};

export function TrustStrip({
  stats,
  ready = true,
}: Readonly<{ stats?: Partial<TrustStripStats>; ready?: boolean }>) {
  if (!ready) return <StatsSkeleton />;

  const verifiedHomes = stats?.verifiedHomes ?? FALLBACK_TRUST_STATS.verifiedHomes;
  const s: TrustStripStats = {
    verifiedHomes: verifiedHomes > 0 ? verifiedHomes : FALLBACK_TRUST_STATS.verifiedHomes,
    noAgentFeesPct: stats?.noAgentFeesPct ?? FALLBACK_TRUST_STATS.noAgentFeesPct,
    avgResponseHours: stats?.avgResponseHours ?? FALLBACK_TRUST_STATS.avgResponseHours,
    tenantRating: stats?.tenantRating ?? FALLBACK_TRUST_STATS.tenantRating,
  };

  return (
    <section
      aria-label="Trust statistics"
      className="border-y border-white/10 bg-(--color-graphite)"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4 sm:px-6">
        <AnimatedStat value={s.verifiedHomes} suffix="+" label="Verified homes" ready />
        <AnimatedStat value={s.noAgentFeesPct} suffix="%" label="No agent fees" ready />
        <AnimatedStat value={s.avgResponseHours} suffix="h" label="Avg response" ready />
        <AnimatedStat
          value={s.tenantRating}
          label="Tenant rating"
          decimals={1}
          ready
          suffixIcon={Star}
        />
      </div>
    </section>
  );
}

export function FeaturedListings({
  featured,
  isBoosted,
  loading = false,
}: Readonly<{ featured: Property[]; isBoosted: boolean; loading?: boolean }>) {
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="skeleton h-8 w-64" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_SKELETON_KEYS.map((id) => (
            <div key={id}>
              <ListingCardSkeleton />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!featured.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
      <ScrollReveal className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {isBoosted ? "Featured listings" : "Featured"}
          </p>
          <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
            {isBoosted ? "Boosted homes, top of search" : "Verified homes, ready to view"}
          </h2>
        </div>
        <Link
          to="/tenant"
          className="hidden text-sm font-semibold text-primary hover:underline sm:inline"
        >
          See all →
        </Link>
      </ScrollReveal>
      <ScrollRevealStagger
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        stagger={0.08}
      >
        {featured.map((p) => (
          <ScrollRevealItem key={p.id}>
            <PropertyCard p={p} />
          </ScrollRevealItem>
        ))}
      </ScrollRevealStagger>
    </section>
  );
}

export function PopularNeighborhoods({
  hoods,
  minRentByHood,
  loading = false,
}: Readonly<{
  hoods: { name: string; count: number }[];
  minRentByHood?: Record<string, number>;
  loading?: boolean;
}>) {
  if (loading) {
    return (
      <section className="border-t bg-secondary/40">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="skeleton h-8 w-72" />
          <NeighborhoodGridSkeleton />
        </div>
      </section>
    );
  }
  const fallback = [
    "Kilimani",
    "Westlands",
    "Karen",
    "Lavington",
    "Kileleshwa",
    "Kasarani",
    "South B",
    "Roysambu",
  ];
  const items = hoods.length ? hoods : fallback.map((name) => ({ name, count: 0 }));

  return (
    <section className="border-t bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <ScrollReveal className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Where Nairobi lives
            </p>
            <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
              Popular neighborhoods
            </h2>
          </div>
        </ScrollReveal>
        <ScrollRevealStagger
          className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          stagger={0.06}
        >
          {items.map((h) => {
            const meta = HOOD_META[h.name];
            const liveMin = minRentByHood?.[h.name];
            return (
              <ScrollRevealItem key={h.name}>
                <NeighborhoodCard3D
                  name={h.name}
                  minPrice={liveMin ?? meta?.from ?? 15000}
                  image={meta?.img}
                  count={h.count}
                />
              </ScrollRevealItem>
            );
          })}
        </ScrollRevealStagger>
        <div className="mt-8">
          <AdUnit
            variant="banner"
            label="Partner"
            title="Advertise on NyumbaSearch"
            body="Reach verified tenants searching for homes in Nairobi."
            href="/advertise"
          />
        </div>
      </div>
    </section>
  );
}

export function ServiceTeaserRow({ counts }: Readonly<{ counts?: Record<string, number> }>) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Services</p>
          <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            Everything after you move in
          </h2>
        </div>
        <Link to="/services" className="text-sm font-semibold text-primary hover:underline">
          View all →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SERVICE_CATEGORIES.map((c) => {
          const count = counts?.[c.id];
          return (
            <Link
              key={c.id}
              to="/services/$category"
              params={{ category: c.id }}
              className="group flex flex-col items-center rounded-2xl border bg-card p-4 text-center text-xs font-semibold transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ServiceCategoryIcon categoryId={c.id} size="sm" />
              <p className="mt-2 group-hover:text-primary">{c.label}</p>
              {count != null && count > 0 ? (
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                  {count} provider{count === 1 ? "" : "s"}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
      <Link
        to="/services/register"
        className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline"
      >
        Join as a service provider →
      </Link>
    </section>
  );
}

function AgencyLogosSkeleton() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-6 w-28 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function AgencyPartnerGrid({ agencies }: Readonly<{ agencies: FeaturedAgency[] }>) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
      {agencies.map((agency) => (
        <div
          key={agency.id}
          className="flex items-center gap-2 font-display text-sm font-semibold text-foreground/80"
        >
          {agency.logoUrl ? (
            <img src={agency.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : null}
          <span>{agency.name}</span>
          {agency.listingCount > 0 ? (
            <span className="text-[10px] font-normal text-muted-foreground">
              · {agency.listingCount} live
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function AgencyLogosBody({
  loading,
  agencies,
}: Readonly<{ loading: boolean; agencies: FeaturedAgency[] }>) {
  if (loading) return <AgencyLogosSkeleton />;
  if (agencies.length > 0) return <AgencyPartnerGrid agencies={agencies} />;
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      Verified agencies list here as they join NyumbaSearch.
    </p>
  );
}

export function AgencyLogosSection({
  agencies = [],
  loading = false,
}: Readonly<{ agencies?: FeaturedAgency[]; loading?: boolean }>) {
  return (
    <section className="border-y bg-secondary/30 py-10">
      <div className="mx-auto max-w-7xl px-5 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trusted agency partners
        </p>
        <AgencyLogosBody loading={loading} agencies={agencies} />
        <Link
          to="/pricing"
          hash="agencies"
          className="mt-4 inline-block text-xs font-semibold text-primary"
        >
          Agency plans →
        </Link>
      </div>
    </section>
  );
}
