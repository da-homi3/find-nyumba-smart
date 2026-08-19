import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatKes, prettyType, type Property } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";
import { PlusUpsellBanner } from "@/components/PlusUpsellBanner";
import { PremiumFeatureLock } from "@/components/PremiumFeatureLock";
import {
  getRecommendationFeed,
  recordRecommendationEvent,
  recordRecommendationFeedback,
} from "@/lib/api/recommendation.functions";
import { updateTenantSearchPrefs } from "@/lib/api/tenant-profile.functions";
import { errorMessage } from "@/lib/utils";
import type { HydratedRecItem, HydratedRecommendationFeed } from "@/lib/recommendations/service";

export function RecommendationHome({
  userId,
  isPlus,
}: Readonly<{ userId: string; isPlus: boolean }>) {
  const { data, isLoading } = useQuery({
    queryKey: ["recommendation-feed", userId],
    queryFn: () => getRecommendationFeed({ data: {} }),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data?.shelves.length) return;
    void recordRecommendationEvent({
      data: { eventName: "recommendation_impression", shelfId: data.shelves[0]?.id },
    }).catch(() => undefined);
  }, [data?.shelves]);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-5 pt-6">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </section>
    );
  }
  if (!data) return null;
  if (data.coldStart) {
    return (
      <section className="mx-auto max-w-2xl px-5 pt-6">
        <p className="font-display text-xl font-semibold">{data.greeting}</p>
        <RecOnboardingCard />
      </section>
    );
  }

  const top = data.shelves.find((s) => s.id === "recommended_for_you")?.items[0]
    ?? data.shelves[0]?.items[0];
  const byId = Object.fromEntries(data.shelves.map((s) => [s.id, s]));
  const homeShelfIds = isPlus
    ? (["recommended_for_you", "new_in_your_areas", "from_providers_you_follow", "price_drops", "near_preferred_locations"] as const)
    : (["based_on_your_search", "similar_to_shortlist", "just_listed"] as const);
  const homeShelves = homeShelfIds.map((id) => byId[id]).filter(Boolean);

  return (
    <section className="mx-auto max-w-2xl px-5 pt-6 space-y-8">
      <div>
        <p className="font-display text-xl font-semibold">{data.greeting}</p>
        <p className="text-sm text-muted-foreground">
          {isPlus ? "Your home search" : "Based on your search and saved homes."}
        </p>
      </div>
      {top?.property ? <TopMatchHero item={top} plus={data.plus} /> : null}
      {isPlus && data.newMatchCount > 0 ? (
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">New matches</p>
          <p className="mt-1 text-sm">
            {data.newMatchCount} {data.newMatchCount === 1 ? "property matches" : "properties match"} your preferences
          </p>
        </article>
      ) : null}
      {homeShelves.map((shelf) => (
        <RecShelf key={shelf.id} shelf={shelf} plus={data.plus} isPlus={isPlus} />
      ))}
      {data.plus && data.providers.length > 0 ? (
        <ProvidersYouMayLike providers={data.providers} />
      ) : null}
      {isPlus && data.exploreLocation ? (
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Explore</p>
          <p className="mt-1 text-sm">Homes near {data.exploreLocation}</p>
          <p className="mt-1 text-xs text-muted-foreground">Nearby areas — not a change to your search</p>
        </article>
      ) : null}
      {!isPlus ? (
        <PlusUpsellBanner
          dismissKey="recs-home"
          title="NyumbaSearch learns what you're looking for"
          body="Tenant Plus unlocks personalized matches, provider discovery, new-listing alerts, and why-this explanations."
        />
      ) : null}
      <HowRecommendationsWork text={data.howItWorks} />
    </section>
  );
}

function TopMatchHero({ item, plus }: Readonly<{ item: HydratedRecItem; plus: boolean }>) {
  const p = item.property!;
  return (
    <article className="rounded-2xl border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Your top match</p>
      {plus ? <MatchScore score={item.matchScore} reasons={item.reasons} discovery={item.discovery} /> : null}
      <h3 className="mt-2 font-display text-lg font-semibold">
        {p.bedrooms} Bedroom {prettyType(p.property_type)}
      </h3>
      <p className="text-sm text-muted-foreground">{p.neighborhood}</p>
      <p className="mt-1 text-sm font-semibold">{formatKes(p.rent_kes)}/month</p>
      <Link
        to="/tenant/property/$id"
        params={{ id: p.id }}
        className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        onClick={() => {
          void recordRecommendationEvent({
            data: { eventName: "recommendation_click", propertyId: p.id, shelfId: "recommended_for_you" },
          });
        }}
      >
        View property
      </Link>
    </article>
  );
}

function RecShelf({
  shelf,
  plus,
  isPlus,
}: Readonly<{
  shelf: HydratedRecommendationFeed["shelves"][number];
  plus: boolean;
  isPlus: boolean;
}>) {
  const visible = shelf.items.filter((item) => item.property);
  if (visible.length === 0) return null;
  if (shelf.plusOnly && !isPlus) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold">{shelf.title}</h2>
        <div className="mt-3">
          <PremiumFeatureLock
            compact
            title={shelf.title}
            body="Upgrade to Tenant Plus for personalized shelves, new matches, and provider recommendations."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">{shelf.title}</h2>
      {shelf.subtitle ? <p className="text-xs text-muted-foreground">{shelf.subtitle}</p> : null}
      <div className="-mx-5 mt-3 flex min-w-0 gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
        {visible.slice(0, 6).map((item) => (
          <div key={item.propertyId} className="w-[min(100%,18rem)] shrink-0">
            <RecPropertyCard item={item} plus={plus} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecPropertyCard({
  item,
  plus,
}: Readonly<{ item: HydratedRecItem; plus: boolean }>) {
  const p = item.property as Property;
  const qc = useQueryClient();
  const hide = useMutation({
    mutationFn: (action: "not_interested" | "not_my_location" | "too_expensive" | "too_small" | "already_rented" | "not_my_property_type" | "hide" | "dont_recommend_provider") =>
      recordRecommendationFeedback({
        data: { action, propertyId: p.id, ownerId: action === "dont_recommend_provider" ? p.owner_id ?? undefined : undefined },
      }),
    onSuccess: () => {
      toast.success("We'll show fewer homes like this");
      void qc.invalidateQueries({ queryKey: ["recommendation-feed"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <div className="rounded-2xl border bg-card">
      {plus ? (
        <div className="px-3 pt-3">
          <MatchScore
            score={item.matchScore}
            reasons={item.reasons}
            discovery={item.discovery}
            previousRentKes={item.previousRentKes}
            newRentKes={item.newRentKes}
          />
        </div>
      ) : null}
      <PropertyCard p={p} />
      {plus ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3 text-[11px]">
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("not_interested")}>
            Not interested
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("not_my_location")}>
            Not my location
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("too_expensive")}>
            Too expensive
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("too_small")}>
            Too small
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("already_rented")}>
            Already rented
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("not_my_property_type")}>
            Not my type
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("hide")}>
            Hide
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => hide.mutate("dont_recommend_provider")}>
            Don't recommend this provider
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MatchScore({
  score,
  reasons,
  discovery,
  previousRentKes,
  newRentKes,
}: Readonly<{
  score: number;
  reasons: string[];
  discovery?: boolean;
  previousRentKes?: number;
  newRentKes?: number;
}>) {
  const why = reasons.slice(0, 5);
  return (
    <div>
      <p className="text-sm font-bold text-primary">
        {score}% Match
        {discovery ? (
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Discovery
          </span>
        ) : null}
      </p>
      {previousRentKes != null && newRentKes != null ? (
        <p className="mt-1 text-xs">
          Previously {formatKes(previousRentKes)} · now {formatKes(newRentKes)}
        </p>
      ) : null}
      {why.length > 0 ? (
        <div className="mt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Why we recommend this
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {why.map((reason) => (
              <li key={reason}>✓ {reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProvidersYouMayLike({
  providers,
}: Readonly<{ providers: HydratedRecommendationFeed["providers"] }>) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Providers you may like</h2>
      <div className="mt-3 space-y-3">
        {providers.map((provider) => (
          <article key={provider.ownerId} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{provider.name}</p>
                {provider.verified ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified provider
                  </p>
                ) : null}
              </div>
              <p className="text-sm font-bold text-primary">{provider.matchScore}% Match</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {provider.activeCount} active properties
              {provider.matchCount > 0 ? ` · ${provider.matchCount} match your preferences` : ""}
            </p>
            {provider.specialties.length > 0 ? (
              <p className="mt-1 text-xs">Specializes in: {provider.specialties.join(", ")}</p>
            ) : null}
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {provider.reasons.map((reason) => (
                <li key={reason}>✓ {reason}</li>
              ))}
            </ul>
            <Link
              to="/tenant/provider/$ownerId"
              params={{ ownerId: provider.ownerId }}
              className="mt-3 inline-flex text-sm font-semibold text-primary"
            >
              Explore portfolio →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function RecOnboardingCard() {
  const qc = useQueryClient();
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("40000");
  const [budgetMax, setBudgetMax] = useState("60000");
  const [bedrooms, setBedrooms] = useState("2");
  const [propertyType, setPropertyType] = useState("two_bedroom");
  const [moveIn, setMoveIn] = useState("");
  const [parking, setParking] = useState(true);
  const [ready, setReady] = useState<{ count: number; scores: number[] } | null>(null);
  const save = useMutation({
    mutationFn: () =>
      updateTenantSearchPrefs({
        data: {
          preferredLocations: location,
          budgetMin: Number(budgetMin) || 0,
          budgetMax: Number(budgetMax) || 0,
          bedrooms: Number(bedrooms) || 0,
          propertyType,
          moveInDate: moveIn,
          parkingRequired: parking,
        },
      }),
    onSuccess: async () => {
      toast.success("Your home search is ready");
      try {
        const feed = await getRecommendationFeed({ data: {} });
        const top = feed.shelves.find((s) => s.id === "recommended_for_you") ?? feed.shelves[0];
        setReady({
          count: Math.max(feed.newMatchCount, top?.items.length ?? 0, feed.portfolioMatchCount ?? 0),
          scores: (top?.items ?? []).slice(0, 3).map((item) => item.matchScore),
        });
      } catch {
        void qc.invalidateQueries({ queryKey: ["recommendation-feed"] });
      }
      void qc.invalidateQueries({ queryKey: ["tenant-profile-bundle"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  if (ready) {
    return (
      <div className="mt-4 rounded-2xl border bg-card p-4">
        <p className="font-display text-lg font-semibold">Your home search is ready.</p>
        <p className="mt-2 text-sm">
          We found {ready.count || "several"} potential matches
        </p>
        {ready.scores.length > 0 ? (
          <p className="mt-2 text-sm">
            Your top matches: {ready.scores.map((score) => `${score}%`).join("  ")}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ["recommendation-feed"] });
          }}
        >
          Explore recommendations
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-4 rounded-2xl border bg-card p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Tell us what you're looking for
      </p>
      <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
        <span>Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Kilimani"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground">
          <span>Budget min</span>
          <input
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase text-muted-foreground">
          <span>Budget max</span>
          <input
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>
      <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
        <span>Bedrooms</span>
        <input
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground"
        />
      </label>
      <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
        <span>Property type</span>
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground"
        >
          <option value="two_bedroom">2 bedroom</option>
          <option value="one_bedroom">1 bedroom</option>
          <option value="three_bedroom">3 bedroom</option>
          <option value="bedsitter">Bedsitter</option>
          <option value="studio">Studio</option>
          <option value="apartment">Apartment</option>
        </select>
      </label>
      <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
        <span>Move-in</span>
        <input
          type="month"
          value={moveIn}
          onChange={(e) => setMoveIn(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={parking} onChange={(e) => setParking(e.target.checked)} />
        <span>Parking required</span>
      </label>
      <button
        type="submit"
        disabled={save.isPending}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {save.isPending ? "Finding matches…" : "Find my matches"}
      </button>
    </form>
  );
}

export function HowRecommendationsWork({ text }: Readonly<{ text: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs text-muted-foreground">
      <button type="button" className="font-semibold text-primary" onClick={() => setOpen((v) => !v)}>
        How recommendations work
      </button>
      {open ? <p className="mt-2">{text}</p> : null}
    </div>
  );
}
