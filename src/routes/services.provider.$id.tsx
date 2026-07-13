import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { getProviderById } from "@/lib/api/service-provider.functions";
import { formatKes } from "@/lib/properties";
import { Star, MapPin } from "lucide-react";
import {
  ProviderContactActions,
  ProviderContactDetails,
} from "@/components/ProviderContactActions";
import { useState, useEffect } from "react";
import { submitInquiry } from "@/lib/submit-inquiry";
import { formFieldValue } from "@/lib/utils";
import { trackProviderAnalytics } from "@/lib/provider-analytics";

export const Route = createFileRoute("/services/provider/$id")({
  loader: async ({ params }) => {
    const provider = await getProviderById({ data: { id: params.id } });
    return { provider };
  },
  component: ProviderPage,
});

function ProviderPage() {
  const { provider } = Route.useLoaderData();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (provider?.id && !provider.isPlaceholder) {
      trackProviderAnalytics(provider.id, "profile_view");
    }
  }, [provider?.id, provider?.isPlaceholder]);

  if (!provider) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-2xl px-5 py-12 text-center">
          <h1 className="font-display text-2xl font-semibold">Provider not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This business is not listed or is no longer active.
          </p>
          <Link to="/services" className="mt-6 inline-flex text-sm text-primary">
            ← Browse services
          </Link>
        </main>
      </PublicPageShell>
    );
  }

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
        {provider.isPlaceholder && (
          <p className="mt-2 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
            Sample listing — request a quote and we&apos;ll match you with a vetted pro
          </p>
        )}
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
        <ProviderContactDetails provider={provider} />

        <div className="mt-4">
          <ProviderContactActions provider={provider} />
        </div>

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
                  name: formFieldValue(fd, "name"),
                  phone: formFieldValue(fd, "phone"),
                  subject: `Service quote — ${provider.businessName}`,
                  message: formFieldValue(fd, "details", "Quote request"),
                  metadata: {
                    providerId: provider.id,
                    provider: provider.businessName,
                    isPlaceholder: String(provider.isPlaceholder ?? false),
                    address: formFieldValue(fd, "address"),
                  },
                },
                "Quote request sent",
              );
              if (ok) {
                if (!provider.isPlaceholder) {
                  trackProviderAnalytics(provider.id, "quote_request");
                }
                setSent(true);
              }
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
