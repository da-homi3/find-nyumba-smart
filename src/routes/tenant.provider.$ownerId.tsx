import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ShieldCheck } from "lucide-react";
import { getPublicProviderPortfolio } from "@/lib/api/landlord-portfolio.functions";
import { getRecommendationFeed } from "@/lib/api/recommendation.functions";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PropertyCard } from "@/components/PropertyCard";
import { SiteNav } from "@/components/SiteNav";
import { MatchScore } from "@/components/recommendations/RecommendationHome";
import { buildPageHead } from "@/lib/seo/head";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/tenant/provider/$ownerId")({
  head: ({ params }) =>
    buildPageHead({
      title: "Property provider — NyumbaSearch",
      description: "Browse verified rental listings from this NyumbaSearch property provider.",
      path: `/tenant/provider/${params.ownerId}`,
    }),
  component: ProviderPortfolioPage,
});

function ProviderPortfolioPage() {
  const { ownerId } = Route.useParams();
  const { user } = useAuth();
  const { isPlus } = useEntitlements();

  const {
    data: portfolio,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-provider-portfolio", ownerId],
    queryFn: () => getPublicProviderPortfolio({ data: { providerId: ownerId } }),
    staleTime: 5 * 60_000,
  });

  const { data: personalized } = useQuery({
    queryKey: ["provider-matches", user?.id, ownerId],
    enabled: Boolean(user && isPlus),
    queryFn: () => getRecommendationFeed({ data: { ownerId } }),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-5xl px-5 py-10">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !portfolio) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-5xl px-5 py-10">
          <p className="text-sm text-muted-foreground">This provider portfolio is unavailable.</p>
          <Link to="/tenant" className="mt-3 inline-block text-sm font-semibold text-primary">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const topMatch = personalized?.shelves[0]?.items[0];
  const provider = portfolio.provider;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        <Link to="/tenant" className="text-sm font-semibold text-primary">
          ← Home
        </Link>

        <header className="mt-6 flex flex-wrap items-start gap-4 rounded-2xl border bg-card p-5 shadow-soft">
          {provider.logoUrl ? (
            <img
              src={provider.logoUrl}
              alt=""
              className="h-16 w-16 rounded-2xl border object-cover"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {provider.hasVerifiedListings ? (
              <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Verified listings
              </p>
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Property provider
              </p>
            )}
            <h1 className="font-display text-3xl font-semibold">{provider.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {provider.listingCount} active listing{provider.listingCount === 1 ? "" : "s"} on
              NyumbaSearch
            </p>
          </div>
        </header>

        {user && isPlus && topMatch?.property ? (
          <section className="mt-8 rounded-2xl border bg-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Matched for you
            </p>
            <MatchScore
              score={topMatch.matchScore}
              reasons={topMatch.reasons}
              discovery={topMatch.discovery}
            />
            <p className="mt-2 font-semibold">{topMatch.property.title}</p>
            <p className="text-sm text-muted-foreground">{topMatch.property.neighborhood}</p>
            <p className="text-sm font-semibold">{formatKes(topMatch.property.rent_kes)}/month</p>
            <Link
              to="/tenant/property/$id"
              params={{ id: topMatch.property.id }}
              className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              View top match
            </Link>
          </section>
        ) : user && !isPlus ? (
          <p className="mt-6 rounded-xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            Upgrade to NyumbaSearch Plus to see personalized matches from this provider.
          </p>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Available homes</h2>
          {portfolio.listings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No active listings from this provider right now.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {portfolio.listings.map((listing) => (
                <PropertyCard key={listing.id} p={listing} plusMember={isPlus} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
