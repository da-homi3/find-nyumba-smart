import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { MOCK_PROVIDERS } from "@/data/revenue-mock";
import { formatKes } from "@/lib/properties";
import { Star, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { submitInquiry } from "@/lib/submit-inquiry";

export const Route = createFileRoute("/services/provider/$id")({
  component: ProviderPage,
});

function ProviderPage() {
  const { id } = Route.useParams();
  const provider = MOCK_PROVIDERS.find((p) => p.id === id) ?? MOCK_PROVIDERS[0];
  const [sent, setSent] = useState(false);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <Link
          to="/services/$category"
          params={{ category: provider.category }}
          className="text-sm text-primary"
        >
          ← Back to providers
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">{provider.businessName}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="h-4 w-4 fill-gold text-gold" />
          {provider.rating} ({provider.reviewCount} reviews)
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{provider.description}</p>
        <p className="mt-2 text-sm">
          From <strong className="text-primary">{formatKes(provider.startingPriceKes)}</strong>
        </p>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {provider.areasServed.join(", ")}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          {provider.phone}
        </p>

        <p className="mt-8 text-[11px] text-muted-foreground">
          NyumbaSearch earns a referral fee when you book through our partners. You pay nothing
          extra.
        </p>

        {sent ? (
          <p className="mt-6 rounded-xl border bg-success/10 p-4 text-sm text-success">
            Quote request sent. {provider.businessName} will contact you within 2 hours.
          </p>
        ) : (
          <form
            className="mt-6 space-y-3 rounded-2xl border bg-card p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const ok = await submitInquiry(
                {
                  inquiryType: "service_quote",
                  name: String(fd.get("name") ?? ""),
                  phone: String(fd.get("phone") ?? ""),
                  subject: `Service quote — ${provider.businessName}`,
                  message: String(fd.get("details") ?? "Quote request"),
                  metadata: {
                    providerId: provider.id,
                    provider: provider.businessName,
                    address: String(fd.get("address") ?? ""),
                  },
                },
                "Quote request sent",
              );
              if (ok) setSent(true);
            }}
          >
            <h2 className="font-display font-semibold">Request a quote</h2>
            <input
              required
              name="name"
              placeholder="Your name"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              name="phone"
              placeholder="Phone"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              name="address"
              placeholder="Address"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <textarea
              name="details"
              placeholder="Describe what you need"
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Send request
            </button>
          </form>
        )}
      </main>
    </PublicPageShell>
  );
}
