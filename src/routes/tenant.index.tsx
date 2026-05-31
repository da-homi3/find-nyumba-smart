import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { fetchProperties, prettyType } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";
import { useState } from "react";
import heroImg from "@/assets/hero-nairobi.jpg";
import type { PropertyType } from "@/lib/properties";

export const Route = createFileRoute("/tenant/")({
  head: () => ({ meta: [{ title: "Discover homes — NyumbaSearch" }] }),
  component: TenantHome,
});

const neighborhoods = [
  "All",
  "Kilimani",
  "Westlands",
  "Karen",
  "Lavington",
  "Kileleshwa",
  "Kasarani",
  "South B",
  "Roysambu",
];
const propertyTypes: Array<"all" | PropertyType> = [
  "all",
  "bedsitter",
  "single_room",
  "studio",
  "one_bedroom",
  "two_bedroom",
  "three_bedroom",
];

function prettyFilterType(type: "all" | PropertyType) {
  return type === "all"
    ? "Any type"
    : type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TenantHome() {
  const [q, setQ] = useState("");
  const [hood, setHood] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<"all" | PropertyType>("all");
  const [maxRent, setMaxRent] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchProperties,
  });

  const filtered = properties.filter((p) => {
    const matchHood = hood === "All" || p.neighborhood === hood;
    const needle = q.toLowerCase();
    const matchQ =
      !q ||
      p.title.toLowerCase().includes(needle) ||
      p.neighborhood.toLowerCase().includes(needle) ||
      prettyType(p.property_type).toLowerCase().includes(needle);
    const matchType = type === "all" || p.property_type === type;
    const matchRent = !maxRent || p.rent_kes <= Number(maxRent);
    const matchVerified = !verifiedOnly || p.is_verified;
    return matchHood && matchQ && matchType && matchRent && matchVerified;
  });

  const verified = filtered.filter((p) => p.is_verified).slice(0, 4);

  return (
    <div>
      {/* Hero strip */}
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="Neighborhood, type, keyword…"
              className="flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Toggle search filters"
              aria-expanded={showFilters}
              className="rounded-xl bg-foreground p-2 text-background"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
          {showFilters && (
            <div className="mt-3 rounded-2xl border border-background/20 bg-background/95 p-3 text-foreground shadow-elegant">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    Type
                  </span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "all" | PropertyType)}
                    className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none"
                  >
                    {propertyTypes.map((t) => (
                      <option key={t} value={t}>
                        {prettyFilterType(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    Max rent
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={maxRent}
                    onChange={(e) => setMaxRent(e.target.value)}
                    placeholder="KES"
                    className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Verified
                </label>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Chips */}
      <div className="mx-auto -mt-10 max-w-2xl px-5">
        <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {neighborhoods.map((n) => (
            <button
              key={n}
              onClick={() => setHood(n)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition ${
                hood === n
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Verified strip */}
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
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {verified.map((p) => (
              <div key={p.id} className="w-64 shrink-0">
                <PropertyCard p={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI assistant teaser */}
      <section className="mx-auto max-w-2xl px-5 pt-6">
        <div className="flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-accent to-secondary p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-gold-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Ask the NyumbaSearch AI</h3>
            <p className="text-xs text-muted-foreground">
              "Find me a 1BR under 40k near Westlands with reliable water."
            </p>
          </div>
        </div>
      </section>

      {/* All */}
      <section className="mx-auto max-w-2xl px-5 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            <MapPin className="mr-1 inline h-4 w-4 text-primary" />
            {hood === "All" ? "All vacancies" : hood}
          </h2>
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        </div>
        {isLoading ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((p) => (
              <PropertyCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
