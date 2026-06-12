import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { providersForCategory, SERVICE_CATEGORIES } from "@/data/revenue-mock";
import { formatKes } from "@/lib/properties";
import { Star } from "lucide-react";
import { submitInquiry } from "@/lib/submit-inquiry";
import { useState } from "react";

export const Route = createFileRoute("/services/$category")({
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const meta = SERVICE_CATEGORIES.find((c) => c.id === category);
  const providers = providersForCategory(category);
  const [quoteOpen, setQuoteOpen] = useState<string | null>(null);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Link to="/services" className="text-sm text-primary">
          ← All services
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">
          {meta?.emoji} {meta?.label ?? category}
        </h1>

        {category === "movers" && <MovingEstimator />}

        <div className="mt-8 grid gap-4">
          {providers.map((p) => (
            <article key={p.id} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    to="/services/provider/$id"
                    params={{ id: p.id }}
                    className="font-semibold hover:text-primary"
                  >
                    {p.businessName}
                  </Link>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {p.rating} ({p.reviewCount}
                    )
                  </p>
                  <p className="text-xs text-muted-foreground">{p.areasServed.join(", ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">From {formatKes(p.startingPriceKes)}</p>
                  <button
                    type="button"
                    onClick={() => setQuoteOpen(p.id)}
                    className="mt-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Get a quote
                  </button>
                </div>
              </div>
              {quoteOpen === p.id && (
                <form
                  className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const ok = await submitInquiry(
                      {
                        inquiryType: "service_quote",
                        name: String(fd.get("name") ?? ""),
                        phone: String(fd.get("phone") ?? ""),
                        subject: `Service quote — ${p.businessName}`,
                        message: String(fd.get("details") ?? "Quote request"),
                        metadata: {
                          providerId: p.id,
                          provider: p.businessName,
                          category,
                          address: String(fd.get("address") ?? ""),
                        },
                      },
                      `Request sent. ${p.businessName} will contact you within 2 hours.`,
                    );
                    if (ok) setQuoteOpen(null);
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
          ))}
        </div>
      </main>
    </PublicPageShell>
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
          Estimated cost: <strong>KES 8,000 – 15,000</strong> based on distance and size. 3 movers
          in your area are available.
        </p>
      )}
    </div>
  );
}
