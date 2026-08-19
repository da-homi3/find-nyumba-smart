import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRecommendationFeed } from "@/lib/api/recommendation.functions";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { MatchScore } from "@/components/recommendations/RecommendationHome";
import { PropertyCard } from "@/components/PropertyCard";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/tenant/provider/$ownerId")({
  head: () => ({ meta: [{ title: "Provider portfolio — NyumbaSearch" }] }),
  component: ProviderPortfolioPage,
});

function ProviderPortfolioPage() {
  const { ownerId } = Route.useParams();
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const { data, isLoading } = useQuery({
    queryKey: ["recommendation-feed", user?.id, ownerId],
    enabled: Boolean(user),
    queryFn: () => getRecommendationFeed({ data: { ownerId } }),
    staleTime: 5 * 60_000,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-sm text-muted-foreground">Sign in to see homes from this provider that match you.</p>
        <Link to="/auth" className="mt-3 inline-block text-sm font-semibold text-primary">
          Sign in →
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="mx-auto max-w-2xl px-5 py-10"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  const top = data.shelves[0]?.items[0];
  const more = data.shelves.find((s) => s.id === "more_from_this_provider") ?? data.shelves[1];

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/tenant" className="text-sm text-primary">
        ← Home
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">This provider</h1>
      {data.portfolioMatchCount != null ? (
        <p className="mt-2 text-sm">
          {data.portfolioMatchCount} homes match your preferences.
        </p>
      ) : null}
      {top?.property ? (
        <article className="mt-6 rounded-2xl border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Top match</p>
          {data.plus ? (
            <MatchScore score={top.matchScore} reasons={top.reasons} discovery={top.discovery} />
          ) : null}
          <p className="mt-2 font-semibold">{top.property.title}</p>
          <p className="text-sm text-muted-foreground">{top.property.neighborhood}</p>
          <p className="text-sm font-semibold">{formatKes(top.property.rent_kes)}/month</p>
          <Link
            to="/tenant/property/$id"
            params={{ id: top.property.id }}
            className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View property
          </Link>
        </article>
      ) : null}
      {more?.items.length ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">More from this provider</h2>
          <div className="mt-3 grid gap-4">
            {more.items
              .filter((item) => item.property)
              .slice(0, 8)
              .map((item) => (
                <PropertyCard key={item.propertyId} p={item.property!} plusMember={isPlus} />
              ))}
          </div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">No other active homes from this provider right now.</p>
      )}
    </div>
  );
}
