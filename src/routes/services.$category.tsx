import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { listActiveProvidersByCategory } from "@/lib/api/service-provider.functions";
import type { PublicServiceProvider } from "@/lib/api/service-provider.functions";
import { formatKes } from "@/lib/properties";
import { MapPin, Star } from "lucide-react";
import { ProviderContactActions, ProviderContactDetails } from "@/components/ProviderContactActions";
import { submitInquiry } from "@/lib/submit-inquiry";
import { formFieldValue } from "@/lib/utils";
import { useState } from "react";

const VALID_CATEGORIES = new Set(SERVICE_CATEGORIES.map((c) => c.id));

export const Route = createFileRoute("/services/$category")({
  beforeLoad: ({ params }) => {
    if (params.category === "provider") {
      throw redirect({ to: "/services/provider/dashboard" });
    }
    if (!VALID_CATEGORIES.has(params.category)) {
      throw redirect({ to: "/services" });
    }
  },
  loader: async ({ params }) => {
    const providers = await listActiveProvidersByCategory({ data: { category: params.category } });
    return { providers };
  },
  head: ({ params }) => {
    const meta = SERVICE_CATEGORIES.find((c) => c.id === params.category);
    const label = meta?.label ?? params.category;
    return {
      meta: [{ title: `${label} in Nairobi — NyumbaSearch` }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const { providers } = Route.useLoaderData() as { providers: PublicServiceProvider[] };
  const meta = SERVICE_CATEGORIES.find((c) => c.id === category);
  const [quoteOpen, setQuoteOpen] = useState<string | null>(null);
  const showingPlaceholders = providers.every((p: PublicServiceProvider) => p.isPlaceholder);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Link to="/services" className="text-sm font-medium text-primary hover:underline">
          ← All services
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">
          {meta?.emoji} {meta?.label ?? category}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {providers.length} provider{providers.length === 1 ? "" : "s"} serving Nairobi and nearby
          areas. Ratings, areas served, and contact details below.
        </p>

        {showingPlaceholders && (
          <p className="mt-4 rounded-xl border border-dashed bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            Sample listings shown while we onboard local providers. Request a quote and we&apos;ll
            connect you with a vetted professional.
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
            No providers in this category yet.{" "}
            <Link to="/services/register" className="font-semibold text-primary">
              List your business
            </Link>
          </div>
        )}

        <div className="mt-10 rounded-2xl border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Offer this service in Nairobi?</p>
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
            <span className="font-semibold text-primary">
              From {formatKes(p.startingPriceKes)}
            </span>
          </p>

          {p.description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          ) : null}

          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{p.areasServed.join(" · ")}</span>
          </p>

          <ProviderContactDetails provider={p} category={category} size="sm" />
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
            if (ok) onQuoteSent();
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

function MovingEstimator() {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-8 rounded-2xl border bg-secondary/40 p-5">
      <h2 className="font-semibold">Moving cost estimator</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select className="rounded-xl border px-3 py-2 text-sm">
          <option>From: Kilimani</option>
          <option>From: Westlands</option>
        </select>
        <select className="rounded-xl border px-3 py-2 text-sm">
          <option>To: Karen</option>
          <option>To: Kasarani</option>
        </select>
        <select className="rounded-xl border px-3 py-2 text-sm">
          <option>Bedsitter</option>
          <option>1BR</option>
          <option>2BR</option>
        </select>
        <input type="date" className="rounded-xl border px-3 py-2 text-sm" />
      </div>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Get estimate
      </button>
      {show && (
        <p className="mt-3 text-sm">
          Estimated cost: <strong>KES 8,000 – 15,000</strong> based on distance and size. Request a
          quote below to confirm availability.
        </p>
      )}
    </div>
  );
}
