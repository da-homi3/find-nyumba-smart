import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { PublicPageShell } from "@/components/SiteNav";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { listActiveProvidersByCategory } from "@/lib/api/service-provider.functions";
import type { PublicServiceProvider } from "@/lib/api/service-provider.functions";
import { countyNameForCode, PROVIDER_COUNTIES } from "@/lib/provider-counties";
import { formatKes } from "@/lib/properties";
import { MapPin, Star } from "lucide-react";
import { ServiceCategoryIcon } from "@/components/services/ServiceCategoryIcon";
import {
  ProviderContactActions,
  ProviderContactDetails,
} from "@/components/ProviderContactActions";
import { submitInquiry } from "@/lib/submit-inquiry";
import { formFieldValue } from "@/lib/utils";
import { trackProviderAnalytics } from "@/lib/provider-analytics";
import { useState } from "react";
import { KENYA_LOCATION_LABELS, matchLocation } from "@/data/kenya-locations";

const VALID_CATEGORIES = new Set<string>(SERVICE_CATEGORIES.map((c) => c.id));

const servicesCategorySearchSchema = z.object({
  county: z.string().optional(),
});

export const Route = createFileRoute("/services/$category")({
  validateSearch: servicesCategorySearchSchema,
  beforeLoad: ({ params }) => {
    if (params.category === "provider") {
      throw redirect({ to: "/services/provider/dashboard" });
    }
    if (!VALID_CATEGORIES.has(params.category)) {
      throw redirect({ to: "/services" });
    }
  },
  loaderDeps: ({ search }) => ({ county: search?.county }),
  loader: async ({ params, deps }) => {
    const providers = await listActiveProvidersByCategory({
      data: { category: params.category, county: deps.county },
    });
    return { providers, county: deps.county };
  },
  head: ({ params, loaderData }) => {
    const meta = SERVICE_CATEGORIES.find((c) => c.id === params.category);
    const label = meta?.label ?? params.category;
    const countyLabel = countyNameForCode(loaderData?.county);
    const place = countyLabel ?? "Kenya";
    const title = `${label} in ${place} — NyumbaSearch`;
    const description = `Compare verified ${label.toLowerCase()} in ${place}. Request quotes and contact providers on NyumbaSearch.`;
    return buildPageHead({ title, description, path: `/services/${params.category}` });
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const { county: selectedCounty = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { providers } = Route.useLoaderData() as { providers: PublicServiceProvider[] };
  const meta = SERVICE_CATEGORIES.find((c) => c.id === category);
  const [quoteOpen, setQuoteOpen] = useState<string | null>(null);
  const showingPlaceholders = providers.every((p: PublicServiceProvider) => p.isPlaceholder);
  const countyLabel = countyNameForCode(selectedCounty);
  const areaLabel = countyLabel ?? "Kenya";

  function handleCountyChange(code: string) {
    navigate({
      search: (prev) => {
        const next = { ...prev };
        if (code) next.county = code;
        else delete next.county;
        return next;
      },
      replace: true,
    });
  }

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Link to="/services" className="text-sm font-medium text-primary hover:underline">
          ← All services
        </Link>
        <h1 className="mt-4 flex items-center gap-3 font-display text-3xl font-semibold">
          <ServiceCategoryIcon categoryId={category} size="lg" />
          <span>{meta?.label ?? category}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {providers.length} provider{providers.length === 1 ? "" : "s"} serving {areaLabel}.
          Ratings, areas served, and contact details below.
        </p>

        <ServiceCountyFilter selectedCounty={selectedCounty} onChange={handleCountyChange} />

        {showingPlaceholders ? (
          <p className="mt-4 rounded-xl border border-dashed bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            Sample listings shown while we onboard local providers. Request a quote and we&apos;ll
            connect you with a vetted professional.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Showing all {providers.length} active provider{providers.length === 1 ? "" : "s"} in
            this category. Featured listings appear first.
          </p>
        )}

        {category === "movers" && <MovingEstimator />}

        <div className="mt-8 grid gap-4">
          {providers.map((p: PublicServiceProvider) => (
            <ProviderCard
              key={p.id}
              provider={p}
              category={category}
              quoteOpen={quoteOpen === p.id}
              onToggleQuote={() => setQuoteOpen(quoteOpen === p.id ? null : p.id)}
              onQuoteSent={() => setQuoteOpen(null)}
            />
          ))}
        </div>

        {providers.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {selectedCounty ? (
              <>
                No {meta?.label?.toLowerCase() ?? category} providers in {countyLabel} yet. Try{" "}
                <button
                  type="button"
                  onClick={() => handleCountyChange("")}
                  className="font-semibold text-primary hover:underline"
                >
                  all counties
                </button>{" "}
                or check back soon.
              </>
            ) : (
              <>
                No providers in this category yet.{" "}
                <Link to="/services/register" className="font-semibold text-primary">
                  List your business
                </Link>
              </>
            )}
          </div>
        )}

        <div className="mt-10 rounded-2xl border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Offer this service across Kenya?</p>
          <Link
            to="/services/register"
            className="mt-3 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Join as a service provider
          </Link>
        </div>
      </main>
    </PublicPageShell>
  );
}

function ServiceCountyFilter({
  selectedCounty,
  onChange,
}: Readonly<{
  selectedCounty: string;
  onChange: (code: string) => void;
}>) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filter by county:</span>
      <button
        type="button"
        onClick={() => onChange("")}
        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
          !selectedCounty
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        }`}
      >
        All counties
      </button>
      {PROVIDER_COUNTIES.map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => onChange(c.code)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedCounty === c.code
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function ProviderCard({
  provider: p,
  category,
  quoteOpen,
  onToggleQuote,
  onQuoteSent,
}: Readonly<{
  provider: PublicServiceProvider;
  category: string;
  quoteOpen: boolean;
  onToggleQuote: () => void;
  onQuoteSent: () => void;
}>) {
  const tierLabel = p.tier.charAt(0).toUpperCase() + p.tier.slice(1);

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/services/provider/$id"
              params={{ id: p.id }}
              onClick={() => {
                if (!p.isPlaceholder) trackProviderAnalytics(p.id, "directory_view");
              }}
              className="font-display text-lg font-semibold hover:text-primary"
            >
              {p.businessName}
            </Link>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tierLabel}
            </span>
            {p.isPlaceholder && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sample
              </span>
            )}
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />
              {p.rating.toFixed(1)}
              <span className="font-normal text-muted-foreground">
                ({p.reviewCount} review{p.reviewCount === 1 ? "" : "s"})
              </span>
            </span>
            <span className="font-semibold text-primary">From {formatKes(p.startingPriceKes)}</span>
          </p>

          {p.description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.counties.map((county) => (
              <span
                key={county}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
              >
                <MapPin className="h-3 w-3" aria-hidden />
                {county}
              </span>
            ))}
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{p.areasServed.join(" · ")}</span>
          </p>

          <ProviderContactDetails provider={p} size="sm" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ProviderContactActions provider={p} category={category} size="sm" />
        <Link
          to="/services/provider/$id"
          params={{ id: p.id }}
          className="inline-flex items-center rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-secondary"
        >
          View profile
        </Link>
        <button
          type="button"
          onClick={onToggleQuote}
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          {quoteOpen ? "Close quote form" : "Get a quote"}
        </button>
      </div>

      {quoteOpen && (
        <form
          className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const ok = await submitInquiry(
              {
                inquiryType: "service_quote",
                name: formFieldValue(fd, "name"),
                phone: formFieldValue(fd, "phone"),
                subject: `Service quote — ${p.businessName}`,
                message: formFieldValue(fd, "details", "Quote request"),
                metadata: {
                  providerId: p.id,
                  provider: p.businessName,
                  category,
                  isPlaceholder: String(p.isPlaceholder ?? false),
                  address: formFieldValue(fd, "address"),
                },
              },
              `Request sent. ${p.businessName} will contact you within 2 hours.`,
            );
            if (ok) {
              if (!p.isPlaceholder) trackProviderAnalytics(p.id, "quote_request");
              onQuoteSent();
            }
          }}
        >
          <input
            required
            name="name"
            placeholder="Your name"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="phone"
            placeholder="Phone"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <input
            required
            name="address"
            placeholder="Address"
            className="rounded-xl border px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
            name="details"
            placeholder="Describe what you need"
            rows={2}
            className="rounded-xl border px-3 py-2 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground sm:col-span-2"
          >
            Send request
          </button>
          <p className="text-[10px] text-muted-foreground sm:col-span-2">
            NyumbaSearch connects you for free. The provider pays a small referral fee.
          </p>
        </form>
      )}
    </article>
  );
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const MOVE_SIZE_MULTIPLIER: Record<string, number> = {
  Bedsitter: 0.7,
  "1BR": 1,
  "2BR": 1.4,
  "3BR+": 1.9,
};

function MovingEstimator() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [size, setSize] = useState("1BR");
  const [moveDate, setMoveDate] = useState("");
  const [estimate, setEstimate] = useState<{ low: number; high: number } | null>(null);

  function handleEstimate() {
    const fromLoc = matchLocation(from);
    const toLoc = matchLocation(to);
    const multiplier = MOVE_SIZE_MULTIPLIER[size] ?? 1;

    if (!fromLoc || !toLoc) {
      setEstimate({
        low: Math.round(6000 * multiplier),
        high: Math.round(15000 * multiplier),
      });
      return;
    }

    const km = Math.max(5, haversineKm(fromLoc, toLoc));
    const low = Math.round((3500 + km * 75) * multiplier);
    const high = Math.round((5500 + km * 115) * multiplier);
    setEstimate({ low, high });
  }

  return (
    <div className="mt-8 rounded-2xl border bg-secondary/40 p-5">
      <h2 className="font-semibold">Moving cost estimator</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick any town or neighbourhood across all 47 Kenyan counties.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Moving from
          </span>
          <input
            list="mover-locations"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setEstimate(null);
            }}
            placeholder="e.g. Kilimani, Kisumu, Mombasa"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Moving to</span>
          <input
            list="mover-locations"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setEstimate(null);
            }}
            placeholder="e.g. Karen, Nakuru, Eldoret"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Home size</span>
          <select
            value={size}
            onChange={(e) => {
              setSize(e.target.value);
              setEstimate(null);
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option>Bedsitter</option>
            <option>1BR</option>
            <option>2BR</option>
            <option>3BR+</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Move date</span>
          <input
            type="date"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>
      </div>
      <datalist id="mover-locations">
        {KENYA_LOCATION_LABELS.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={handleEstimate}
        disabled={!from.trim() || !to.trim()}
        className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Get estimate
      </button>
      {estimate ? (
        <p className="mt-3 text-sm">
          Estimated cost:{" "}
          <strong>
            {formatKes(estimate.low)} – {formatKes(estimate.high)}
          </strong>{" "}
          based on distance and home size. Request a quote below to confirm availability with a
          mover.
        </p>
      ) : null}
    </div>
  );
}
