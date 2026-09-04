import { Link } from "@tanstack/react-router";
import { Building2, ChevronRight, ShieldCheck } from "lucide-react";
import type { FeaturedAgency } from "@/lib/api/homepage-shared";
import {
  ScrollReveal,
  ScrollRevealStagger,
  ScrollRevealItem,
} from "@/components/motion/ScrollReveal";
import { PremiumFeatureLock } from "@/components/PremiumFeatureLock";
import { useEntitlements } from "@/hooks/use-entitlements";

function formatProviderListingLabel(count: number): string {
  if (count <= 0) return "Verified property provider";
  const suffix = count === 1 ? "" : "s";
  return `${count} live listing${suffix}`;
}

function AgencyCard({ agency }: Readonly<{ agency: FeaturedAgency }>) {
  return (
    <Link
      to="/tenant/provider/$ownerId"
      params={{ ownerId: agency.id }}
      className="group flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="flex items-start gap-3">
        {agency.logoUrl ? (
          <img
            src={agency.logoUrl}
            alt=""
            className="h-12 w-12 rounded-xl border object-cover"
            loading="lazy"
          />
        ) : (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold group-hover:text-primary">
            {agency.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatProviderListingLabel(agency.listingCount)}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Browse this provider&apos;s portfolio and matched homes on NyumbaSearch.
      </p>
    </Link>
  );
}

export function ProviderDiscoverySection({
  agencies = [],
  loading = false,
}: Readonly<{ agencies?: FeaturedAgency[]; loading?: boolean }>) {
  const { isPlus } = useEntitlements();

  if (loading) {
    return (
      <section className="border-y bg-secondary/30 py-12 sm:py-16" aria-busy="true">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="skeleton h-8 w-72" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!agencies.length) return null;

  return (
    <section className="border-y bg-secondary/30 py-12 sm:py-16" aria-label="Property providers">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <ScrollReveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Verified providers
            </p>
            <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
              Discover property providers
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Explore agency and manager portfolios — see their listings and find more homes from
              trusted listers across Nairobi.
            </p>
          </div>
          <Link
            to="/pricing"
            hash="agencies"
            className="text-sm font-semibold text-primary hover:underline"
          >
            List as an agency →
          </Link>
        </ScrollReveal>

        {!isPlus ? (
          <div className="mt-6">
            <PremiumFeatureLock
              title="Provider portfolio matching"
              body="Tenant Plus unlocks smart matching across a provider's full portfolio and saved-home compare tools."
              compact
            />
          </div>
        ) : null}

        <ScrollRevealStagger
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.06}
        >
          {agencies.slice(0, 6).map((agency) => (
            <ScrollRevealItem key={agency.id}>
              <AgencyCard agency={agency} />
            </ScrollRevealItem>
          ))}
        </ScrollRevealStagger>
      </div>
    </section>
  );
}
