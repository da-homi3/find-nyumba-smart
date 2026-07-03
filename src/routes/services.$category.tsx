import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { listActiveProvidersByCategory } from "@/lib/api/service-provider.functions";
import type { PublicServiceProvider } from "@/lib/api/service-provider.functions";
import { formatKes } from "@/lib/properties";
import { Star } from "lucide-react";
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
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const { providers } = Route.useLoaderData();
  const meta = SERVICE_CATEGORIES.find((c) => c.id === category);
  const [quoteOpen, setQuoteOpen] = useState<string | null>(null);
  const showingPlaceholders = providers.every((p) => p.isPlaceholder);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Link to="/services" className="text-sm text-primary">
          ← All services
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">
          {meta?.emoji} {meta?.label ?? category}
        </h1>

        {showingPlaceholders && (
          <p className="mt-4 rounded-xl border border-dashed bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            Sample listings shown while we onboard local providers. Request a quote and we&apos;ll
            connect you with a vetted professional.
          </p>
        )}

        {category === "movers" && <MovingEstimator />}

        <div className="mt-8 grid gap-4">
          {providers.map((p) => (
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
  return (
    <article className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/services/provider/$id"
              params={{ id: p.id }}
              className="font-semibold hover:text-primary"
            >
              {p.businessName}
            </Link>
            {p.isPlaceholder && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sample
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {p.rating} ({p.reviewCount})
          </p>
          <p className="text-xs text-muted-foreground">{p.areasServed.join(", ")}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">From {formatKes(p.startingPriceKes)}</p>
          <button
            type="button"
            onClick={onToggleQuote}
            className="mt-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Get a quote
          </button>
        </div>
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
