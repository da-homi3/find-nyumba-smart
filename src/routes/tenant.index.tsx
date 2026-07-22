import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { type Property, type PropertyType } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";
import { useMemo, useState, useEffect, useRef, type MouseEvent } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { recordSearchEvent } from "@/lib/api/analytics.functions";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";
import heroImg from "@/assets/hero-nairobi.jpg";
import { TenantFiltersBar, type TenantFilters } from "@/components/TenantFiltersBar";
import { EmptyState } from "@/components/EmptyState";
import { defaultTenantFilters, effectiveMaxRent, TENANT_MAX_RENT } from "@/lib/tenant-filter-defaults";
import { getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { listSavedProperties, toggleSavedProperty } from "@/lib/api/nyumba.functions";
import { PlusUpsellBanner } from "@/components/PlusUpsellBanner";
import { AdUnit } from "@/components/AdUnit";
import { ListingGridSkeleton } from "@/components/skeletons/ListingCardSkeleton";
import {
  isPreviewListing,
  mergeListingsForDisplay,
  previewListingStats,
} from "@/lib/listings-preview";
import { SiteNav } from "@/components/SiteNav";
import { currentRedirectPath } from "@/lib/navigation";
import { errorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { useListingsSearch } from "@/hooks/use-listings-search";
import { useTenantBrowseOrigin } from "@/hooks/use-tenant-browse-origin";
import { sortListingsByProximity } from "@/lib/geo/listings-nearby-sort";
import {
  prefetchTenantListings,
  TENANT_LISTINGS_PAGE_SIZE,
} from "@/lib/seo/prefetch-tenant-listings";
import { buildPageHead } from "@/lib/seo/head";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";

const tenantSearchSchema = z.object({
  neighborhood: z.string().optional(),
  maxPrice: z.coerce.number().optional(),
  type: z.string().optional(),
  q: z.string().optional(),
  purpose: z.enum(["all", "rent", "sale"]).optional(),
});

export const Route = createFileRoute("/tenant/")({
  validateSearch: tenantSearchSchema,
  loader: async ({ context }) => {
    await prefetchTenantListings(context.queryClient);
  },
  head: () =>
    buildPageHead({
      title: "Discover homes — NyumbaSearch",
      description:
        "Search verified vacant homes across Kenya. Filter by budget, bedrooms, and area — map view, saved listings, and NyumbaAI.",
      path: "/tenant",
    }),
  component: TenantHome,
});

const PAGE_SIZE = TENANT_LISTINGS_PAGE_SIZE;

function filtersFromSearch(search: z.infer<typeof tenantSearchSchema>): TenantFilters {
  const types = search.type ? [search.type as PropertyType] : [];
  const neighborhood = search.neighborhood ?? "All";
  const listingPurpose = search.purpose ?? "all";
  const scopeFilterActive = types.length > 0 || neighborhood !== "All";
  return {
    ...defaultTenantFilters,
    minRent: scopeFilterActive ? 0 : defaultTenantFilters.minRent,
    maxRent: scopeFilterActive
      ? TENANT_MAX_RENT
      : (search.maxPrice ?? defaultTenantFilters.maxRent),
    neighborhood,
    types,
    listingPurpose,
  };
}

function applyClientFilters(items: Property[], filters: TenantFilters): Property[] {
  let next = items;
  if (filters.types.length > 0) {
    const typeSet = new Set(filters.types);
    next = next.filter((p) => typeSet.has(p.property_type));
  }
  if (filters.listingPurpose === "rent" || filters.listingPurpose === "sale") {
    next = next.filter((p) => (p.pricing_mode ?? "rent") === filters.listingPurpose);
  }
  if (filters.bedrooms != null) {
    next = next.filter((p) => p.bedrooms >= filters.bedrooms!);
  }
  if (filters.waterGoodOnly) {
    next = next.filter((p) => {
      const w = getListingIntel(p).water;
      return w === "Good" || w === "Excellent";
    });
  }
  if (filters.verifiedLevel2Plus) {
    next = next.filter((p) => verificationLevel(p) >= 2);
  }
  return next;
}

function resultCountLabel(
  isLoading: boolean,
  displayCount: number,
  liveCount: number,
  previewCount: number,
): string {
  if (isLoading) return "Loading…";
  if (previewCount > 0) return `${liveCount} live · ${previewCount} uploading`;
  return `${displayCount} results`;
}
function analyticsSessionId(): string | undefined {
  if (globalThis.sessionStorage === undefined) return undefined;
  const existing = globalThis.sessionStorage.getItem("nyumba_sid");
  if (existing) return existing;
  const sid = crypto.randomUUID();
  globalThis.sessionStorage.setItem("nyumba_sid", sid);
  return sid;
}

function TenantHome() {
  const search = Route.useSearch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isTenant } = useAuth();
  const { isPlus } = useEntitlements();
  const qc = useQueryClient();
  const [q, setQ] = useState(search.q ?? "");
  const debouncedQ = useDebouncedValue(q, 400);
  const [page, setPage] = useState(1);
  const lastAnalyticsKey = useRef("");
  const [filters, setFilters] = useState<TenantFilters>(() => filtersFromSearch(search));
  const { origin: browseOrigin } = useTenantBrowseOrigin(filters.neighborhood);

  useEffect(() => {
    setQ(search.q ?? "");
    setPage(1);
    setFilters((f) => ({ ...f, ...filtersFromSearch(search) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync individual URL search params only
  }, [search.q, search.maxPrice, search.neighborhood, search.type, search.purpose]);

  // Remember browse scroll so returning from Map/Saved feels continuous.
  useEffect(() => {
    const key = "nyumba-browse-scroll";
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const y = Number(saved);
        if (Number.isFinite(y) && y > 0) {
          requestAnimationFrame(() => window.scrollTo(0, y));
        }
      }
    } catch {
      // ignore
    }
    const onScroll = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        // ignore
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if ((search.q ?? "") === debouncedQ) return;
    void navigate({
      to: "/tenant",
      search: (prev) => ({ ...prev, q: debouncedQ.trim() || undefined }),
      replace: true,
    });
  }, [debouncedQ, navigate, search.q]);

  const listingFilters = useMemo(() => {
    const typeFilterActive = filters.types.length > 0;
    const areaFilterActive = filters.neighborhood !== "All";
    const browseAllInScope = typeFilterActive || areaFilterActive;
    const nearbySort = filters.sort === "nearby";
    return {
      query: debouncedQ || undefined,
      neighborhood: filters.neighborhood === "All" ? undefined : filters.neighborhood,
      // Type/area chips show every matching listing across the full price range.
      maxRent: browseAllInScope ? undefined : effectiveMaxRent(filters.maxRent),
      minRent: browseAllInScope ? undefined : filters.minRent,
      propertyType: filters.types.length === 1 ? filters.types[0] : undefined,
      pricingMode: filters.listingPurpose === "all" ? undefined : filters.listingPurpose,
      sortBy: filters.sort,
      originLat: nearbySort ? browseOrigin.lat : undefined,
      originLng: nearbySort ? browseOrigin.lng : undefined,
      // Nearby ranking needs a wide pool; type/area chips already fetch broadly.
      // Cap at 200 so Worker + CDN stay healthy under concurrent tenants.
      limit: nearbySort || browseAllInScope ? Math.max(PAGE_SIZE * page, 200) : PAGE_SIZE * page,
      offset: 0,
    };
  }, [
    browseOrigin.lat,
    browseOrigin.lng,
    debouncedQ,
    filters.neighborhood,
    filters.maxRent,
    filters.minRent,
    filters.listingPurpose,
    filters.sort,
    filters.types,
    page,
  ]);

  const {
    data: searchResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useListingsSearch(listingFilters);

  const { data: savedList = [] } = useQuery({
    queryKey: ["saved-properties", user?.id],
    enabled: !!user && isTenant,
    queryFn: () => listSavedProperties(),
  });
  const savedIds = useMemo(() => new Set(savedList.map((p) => p.id)), [savedList]);

  const toggleSave = useMutation({
    mutationFn: async ({ propertyId, saved }: { propertyId: string; saved: boolean }) => {
      if (!user) throw new Error("Sign in to save properties");
      await toggleSavedProperty({ data: { propertyId, saved: !saved } });
    },
    onSuccess: (_, { saved }) => {
      qc.invalidateQueries({ queryKey: ["saved-properties"] });
      toast.success(saved ? "Removed from saved" : "Saved to your list");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const filtered = useMemo(
    () => applyClientFilters(searchResult?.items ?? [], filters),
    [searchResult?.items, filters],
  );

  const displayListings = useMemo(() => mergeListingsForDisplay(filtered), [filtered]);
  const listingStats = useMemo(() => previewListingStats(filtered), [filtered]);

  useEffect(() => {
    if (isLoading || isError || !hasAnalyticsConsent()) return;
    const key = `${debouncedQ}|${filters.neighborhood}|${displayListings.length}`;
    if (key === lastAnalyticsKey.current) return;
    lastAnalyticsKey.current = key;
    void recordSearchEvent({
      data: {
        query: debouncedQ || undefined,
        neighborhood: filters.neighborhood === "All" ? undefined : filters.neighborhood,
        resultCount: displayListings.length,
        sessionId: analyticsSessionId(),
        userId: user?.id,
      },
    });
  }, [debouncedQ, filters.neighborhood, displayListings.length, isLoading, isError, user?.id]);

  const sortedFiltered = useMemo(() => {
    const now = Date.now();
    if (filters.sort === "nearby") {
      return sortListingsByProximity(displayListings, browseOrigin, now);
    }
    if (filters.sort === "newest") {
      return [...displayListings].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      );
    }
    return [...displayListings].sort((a, b) => {
      const aBoost = a.featured_until && new Date(a.featured_until).getTime() > now ? 1 : 0;
      const bBoost = b.featured_until && new Date(b.featured_until).getTime() > now ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
      return 0;
    });
  }, [browseOrigin, displayListings, filters.sort]);

  const visible = sortedFiltered.slice(0, page * PAGE_SIZE);
  const verified = [...displayListings]
    .filter((p) => p.is_verified)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 4);
  const boostedPool = useMemo(
    () =>
      displayListings.filter(
        (p) => p.featured_until && new Date(p.featured_until).getTime() > Date.now(),
      ),
    [displayListings],
  );

  const patchFilters = (patch: Partial<TenantFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      // Selecting a property type or area expands budget so high- and low-priced homes both appear.
      if ((patch.types && patch.types.length > 0) || (patch.neighborhood && patch.neighborhood !== "All")) {
        next.minRent = 0;
        next.maxRent = TENANT_MAX_RENT;
      }
      void navigate({
        to: "/tenant",
        search: (prev) => ({
          ...prev,
          neighborhood: next.neighborhood !== "All" ? next.neighborhood : undefined,
          maxPrice: next.maxRent < TENANT_MAX_RENT ? next.maxRent : undefined,
          type: next.types[0] || undefined,
          purpose: next.listingPurpose !== "all" ? next.listingPurpose : undefined,
          q: q.trim() || undefined,
        }),
        replace: true,
      });
      return next;
    });
    setPage(1);
  };

  const handleToggleSave = (propertyId: string) => (e: MouseEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to save homes");
      navigate({ to: "/auth", search: { redirect: currentRedirectPath(location) } });
      return;
    }
    if (!isTenant) {
      toast.info("Switch to a tenant account to save homes.");
      return;
    }
    const listing = displayListings.find((p) => p.id === propertyId);
    if (listing && isPreviewListing(listing)) {
      toast.info(
        "Preview listings cannot be saved yet. Save live listings from verified landlords.",
      );
      return;
    }
    void toggleSave.mutateAsync({ propertyId, saved: savedIds.has(propertyId) });
  };

  return (
    <div>
      <SiteNav variant="light" />
      <header className="relative isolate overflow-hidden px-5 pt-6 pb-20 text-primary-foreground">
        <img
          src={heroImg}
          alt="Aerial view of a leafy Nairobi neighbourhood at golden hour"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-foreground/75 via-foreground/55 to-primary/85" />
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
            Karibu
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">
            Find your next home in Nairobi
          </h1>
          <div
            className="mt-6 flex items-center gap-2 rounded-2xl bg-background p-2 shadow-elegant"
            data-tour="tenant-search"
          >
            <Search className="ml-2 h-5 w-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Neighborhood, type, keyword…"
              className="flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Link
              to="/tenant/map"
              className="rounded-xl bg-foreground p-2 text-background"
              aria-label="Open map view"
            >
              <MapPin className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <TenantFiltersBar
        filters={filters}
        onChange={patchFilters}
        resultCount={displayListings.length}
        resultsLoading={isLoading}
      />

      {isFetching && !isLoading ? (
        <p className="mx-auto max-w-2xl px-5 pt-2 text-xs text-muted-foreground">
          Updating results…
        </p>
      ) : null}

      <RecentlyViewedStrip />

      {!isPlus && (
        <div className="mx-auto max-w-2xl px-5 pt-4">
          <PlusUpsellBanner dismissKey="tenant-browse-top" />
        </div>
      )}

      {verified.length > 0 && (
        <section className="mx-auto min-w-0 max-w-2xl overflow-x-clip px-5 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Recently verified
            </h2>
            <Link to="/tenant/map" className="text-xs font-medium text-primary">
              Map view →
            </Link>
          </div>
          <div className="-mx-5 mt-3 flex min-w-0 gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
            {verified.map((p) => (
              <div key={p.id} className="w-[min(100%,18rem)] shrink-0 snap-start sm:w-72">
                <PropertyCard
                  p={p}
                  preview={isPreviewListing(p)}
                  saved={savedIds.has(p.id)}
                  plusMember={isPlus}
                  onToggleSave={handleToggleSave(p.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-2xl px-5 pt-6">
        <div className="flex items-start gap-3 rounded-2xl border bg-linear-to-br from-accent to-secondary p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-gold-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Ask NyumbaAI</h3>
            <p className="text-xs text-muted-foreground">
              Tap the chat bubble — verified property owners, no scams, just honest neighbourhood advice.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 pt-8 pb-24 md:pb-12" data-tour="tenant-listings">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            <MapPin className="mr-1 inline h-4 w-4 text-primary" />
            {filters.neighborhood === "All" ? "All vacancies" : filters.neighborhood}
          </h2>
          <span className="text-xs text-muted-foreground">
            {resultCountLabel(
              isLoading,
              displayListings.length,
              listingStats.liveCount,
              listingStats.previewCount,
            )}
          </span>
        </div>
        <TenantListingsGrid
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          displayCount={displayListings.length}
          visible={visible}
          boostedPool={boostedPool}
          savedIds={savedIds}
          isPlus={isPlus}
          onRetry={() => void refetch()}
          onLoadMore={() => setPage((n) => n + 1)}
          onToggleSave={handleToggleSave}
          onClearFilters={() => setFilters(defaultTenantFilters)}
        />
      </section>
      <OnboardingTourHost tourId="tenant-browse" />
    </div>
  );
}

type TenantListingsGridProps = Readonly<{
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  displayCount: number;
  visible: Property[];
  boostedPool: Property[];
  savedIds: Set<string>;
  isPlus: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onToggleSave: (propertyId: string) => (e: MouseEvent) => void;
  onClearFilters: () => void;
}>;

function TenantListingsGrid({
  isLoading,
  isError,
  errorMessage,
  displayCount,
  visible,
  boostedPool,
  savedIds,
  isPlus,
  onRetry,
  onLoadMore,
  onToggleSave,
  onClearFilters,
}: TenantListingsGridProps) {
  if (isLoading) {
    return <ListingGridSkeleton count={9} />;
  }

  if (isError && displayCount === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-destructive/30 p-10 text-center">
        <p className="text-sm font-medium text-destructive">Couldn&apos;t load listings</p>
        {errorMessage ? <p className="mt-2 text-xs text-muted-foreground">{errorMessage}</p> : null}
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  if (displayCount === 0) {
    return <EmptyState type="no_search_results" className="mt-8" onAction={onClearFilters} />;
  }

  return (
    <>
      {isError ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Showing saved results — refresh failed.</span>
          <button type="button" onClick={onRetry} className="font-semibold text-primary">
            Retry
          </button>
        </div>
      ) : null}      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p, index) => {
          const slot = index + 1;
          const boosted = boostedPool.length > 0 ? boostedPool[slot % boostedPool.length] : null;
          const showPromo = slot % 6 === 0;
          return (
            <div key={p.id} className="contents">
              <PropertyCard
                p={p}
                preview={isPreviewListing(p)}
                saved={savedIds.has(p.id)}
                plusMember={isPlus}
                onToggleSave={onToggleSave(p.id)}
              />
              {showPromo &&
                (boosted ? (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gold">
                      Featured listing
                    </p>
                    <PropertyCard
                      p={boosted}
                      preview={isPreviewListing(boosted)}
                      plusMember={isPlus}
                    />
                  </div>
                ) : (
                  <AdUnit
                    label="Partner"
                    title="Advertise on NyumbaSearch"
                    body="Reach verified tenants searching for homes in Nairobi."
                    href="/advertise"
                  />
                ))}
            </div>
          );
        })}
      </div>
      {visible.length < displayCount && (
        <button
          type="button"
          onClick={onLoadMore}
          className="mt-6 w-full rounded-xl border py-3 text-sm font-semibold hover:bg-secondary"
        >
          Load more ({displayCount - visible.length} remaining)
        </button>
      )}
    </>
  );
}
