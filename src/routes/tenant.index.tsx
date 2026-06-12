import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { searchProperties, type PropertyType } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";
import { useMemo, useState, useEffect } from "react";
import heroImg from "@/assets/hero-nairobi.jpg";
import { TenantFiltersBar, type TenantFilters } from "@/components/TenantFiltersBar";
import { defaultTenantFilters } from "@/lib/tenant-filter-defaults";
import { isDemoListingId } from "@/data/mockListings";
import { getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { listSavedProperties, toggleSavedProperty } from "@/lib/api/nyumba.functions";
import { PlusUpsellBanner } from "@/components/PlusUpsellBanner";
import { AdUnit } from "@/components/AdUnit";
import { toast } from "sonner";
import { z } from "zod";

const tenantSearchSchema = z.object({
  neighborhood: z.string().optional(),
  maxPrice: z.coerce.number().optional(),
  type: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/tenant/")({
  validateSearch: tenantSearchSchema,
  head: () => ({ meta: [{ title: "Discover homes — NyumbaSearch" }] }),
  component: TenantHome,
});

const LISTING_SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;
const PAGE_SIZE = 12;

function TenantHome() {
  const search = Route.useSearch();
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const qc = useQueryClient();
  const [q, setQ] = useState(search.q ?? "");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TenantFilters>(() => ({
    ...defaultTenantFilters,
    maxRent: search.maxPrice ?? defaultTenantFilters.maxRent,
    neighborhood: search.neighborhood ?? "All",
    types: search.type ? [search.type as PropertyType] : [],
  }));

  useEffect(() => {
    setQ(search.q ?? "");
    setPage(1);
    setFilters((f) => ({
      ...f,
      maxRent: search.maxPrice ?? defaultTenantFilters.maxRent,
      neighborhood: search.neighborhood ?? "All",
      types: search.type ? [search.type as PropertyType] : [],
    }));
  }, [search.q, search.maxPrice, search.neighborhood, search.type]);

  const {
    data: searchResult,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["properties", q, filters.neighborhood, filters.maxRent, filters.sort],
    queryFn: () =>
      searchProperties({
        query: q || undefined,
        neighborhood: filters.neighborhood !== "All" ? filters.neighborhood : undefined,
        maxRent: filters.maxRent,
        minRent: filters.minRent,
        sortBy: filters.sort,
        limit: 100,
      }),
  });

  const { data: savedList = [] } = useQuery({
    queryKey: ["saved-properties", user?.id],
    enabled: !!user,
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
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let items = searchResult?.items ?? [];
    if (filters.types.length > 0) {
      items = items.filter((p) => filters.types.includes(p.property_type));
    }
    if (filters.bedrooms != null) {
      items = items.filter((p) => p.bedrooms >= filters.bedrooms!);
    }
    if (filters.waterGoodOnly) {
      items = items.filter((p) => {
        const w = getListingIntel(p).water;
        return w === "Good" || w === "Excellent";
      });
    }
    if (filters.verifiedLevel2Plus) {
      items = items.filter((p) => verificationLevel(p) >= 2);
    }
    return items;
  }, [searchResult?.items, filters]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const verified = filtered.filter((p) => p.is_verified).slice(0, 4);
  const boostedPool = useMemo(
    () =>
      filtered.filter((p) => p.featured_until && new Date(p.featured_until).getTime() > Date.now()),
    [filtered],
  );

  const patchFilters = (patch: Partial<TenantFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const handleToggleSave = (propertyId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to save homes");
      return;
    }
    if (isDemoListingId(propertyId)) {
      toast.info("Demo listings cannot be saved. Save live listings from verified landlords.");
      return;
    }
    void toggleSave.mutateAsync({ propertyId, saved: savedIds.has(propertyId) });
  };

  return (
    <div>
      <header className="relative isolate overflow-hidden px-5 pt-10 pb-20 text-primary-foreground">
        <img
          src={heroImg}
          alt="Aerial view of a leafy Nairobi neighbourhood at golden hour"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-foreground/75 via-foreground/55 to-primary/85" />
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
            Karibu
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">
            Find your next home in Nairobi
          </h1>
          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-background p-2 shadow-elegant">
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

      <TenantFiltersBar filters={filters} onChange={patchFilters} resultCount={filtered.length} />

      {!isPlus && (
        <div className="mx-auto max-w-2xl px-5 pt-4">
          <PlusUpsellBanner dismissKey="tenant-browse-top" />
        </div>
      )}

      {verified.length > 0 && (
        <section className="mx-auto max-w-2xl px-5 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Recently verified
            </h2>
            <Link to="/tenant/map" className="text-xs font-medium text-primary">
              Map view →
            </Link>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {verified.map((p) => (
              <div key={p.id} className="w-72 shrink-0">
                <PropertyCard
                  p={p}
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
        <div className="flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-accent to-secondary p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-gold-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Ask NyumbaAI</h3>
            <p className="text-xs text-muted-foreground">
              Tap the chat bubble — no agents, no scams, just honest neighbourhood advice.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 pt-8 pb-12">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            <MapPin className="mr-1 inline h-4 w-4 text-primary" />
            {filters.neighborhood === "All" ? "All vacancies" : filters.neighborhood}
          </h2>
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        </div>
        {isLoading ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LISTING_SKELETON_KEYS.map((id) => (
              <div key={id} className="overflow-hidden rounded-2xl border">
                <div className="aspect-video animate-pulse bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="mt-8 rounded-2xl border border-destructive/30 p-10 text-center">
            <p className="text-sm font-medium text-destructive">Couldn&apos;t load listings</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No homes match these filters. Try widening your budget or turning off water filters.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p, index) => {
                const slot = index + 1;
                const boosted = boostedPool.length ? boostedPool[slot % boostedPool.length] : null;
                return (
                  <div key={p.id} className="contents">
                    <PropertyCard
                      p={p}
                      saved={savedIds.has(p.id)}
                      plusMember={isPlus}
                      onToggleSave={handleToggleSave(p.id)}
                    />
                    {slot % 6 === 0 &&
                      (boosted ? (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gold">
                            Featured listing
                          </p>
                          <PropertyCard p={boosted} plusMember={isPlus} showSave={false} />
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
            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => setPage((n) => n + 1)}
                className="mt-6 w-full rounded-xl border py-3 text-sm font-semibold hover:bg-secondary"
              >
                Load more ({filtered.length - visible.length} remaining)
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
