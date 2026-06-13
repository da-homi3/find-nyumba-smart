import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { Property } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";
import { AdUnit } from "@/components/AdUnit";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { HOOD_META } from "@/components/landing/hood-meta";
import { AnimatedStat } from "@/components/motion/AnimatedStat";
import { NeighborhoodCard3D } from "@/components/landing/NeighborhoodCard3D";

export function TrustStrip() {
  return (
    <section
      aria-label="Trust statistics"
      className="border-y border-white/10 bg-[var(--color-graphite)]"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4 sm:px-6">
        <AnimatedStat value={10000} suffix="+" label="Verified homes" />
        <AnimatedStat value={98} suffix="%" label="No agent fees" />
        <AnimatedStat value={24} suffix="h" label="Avg response" />
        <AnimatedStat value={4.7} suffix="★" label="Tenant rating" decimals={1} />
      </div>
    </section>
  );
}

export function FeaturedListings({
  featured,
  isBoosted,
}: Readonly<{ featured: Property[]; isBoosted: boolean }>) {
  if (!featured.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {isBoosted ? "Featured listings" : "Featured"}
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            {isBoosted ? "Boosted homes, top of search" : "Verified homes, ready to view"}
          </h2>
        </div>
        <Link
          to="/tenant"
          className="hidden text-sm font-semibold text-primary hover:underline sm:inline"
        >
          See all →
        </Link>
      </div>
      <div className="mt-8 flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {featured.map((p) => (
          <div key={p.id} className="w-72 shrink-0 sm:w-auto">
            <PropertyCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function PopularNeighborhoods({
  hoods,
}: Readonly<{ hoods: { name: string; count: number }[] }>) {
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
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Where Nairobi lives
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
              Popular neighborhoods
            </h2>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((h) => {
            const meta = HOOD_META[h.name];
            return (
              <NeighborhoodCard3D
                key={h.name}
                name={h.name}
                minPrice={meta?.from ?? 15000}
                image={meta?.img}
                count={h.count}
              />
            );
          })}
        </div>
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

export function ServiceTeaserRow() {
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
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {SERVICE_CATEGORIES.slice(0, 8).map((c) => (
          <Link
            key={c.id}
            to="/services/$category"
            params={{ category: c.id }}
            className="rounded-2xl border bg-card p-4 text-center text-xs font-semibold hover:border-primary/30"
          >
            <span className="text-2xl">{c.emoji}</span>
            <p className="mt-2">{c.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AgencyLogosSection() {
  const agencies = ["Sunrise Realty", "Nairobi Homes Co.", "Prime Estates", "Urban Nest Agency"];
  return (
    <section className="border-y bg-secondary/30 py-10">
      <div className="mx-auto max-w-7xl px-5 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trusted agency partners
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-80">
          {agencies.map((name) => (
            <span key={name} className="font-display text-sm font-semibold text-foreground/70">
              {name}
            </span>
          ))}
        </div>
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
