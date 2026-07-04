import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { PublicPageShell } from "@/components/SiteNav";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { ADVERTISE_PACKAGES, advertisePackagePrice } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({
  package: z
    .enum([
      "listing_banner",
      "homepage_hero",
      "neighbourhood",
      "email_newsletter",
      "category_sponsor",
      "whatsapp_blast",
      "custom",
    ])
    .default("listing_banner"),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/advertise/pay")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Pay for advertising — NyumbaSearch" }] }),
  component: AdvertisePayPage,
});

function AdvertisePayPage() {
  const { user } = useAuth();
  const { package: packageId, ref } = Route.useSearch();
  const pkg = ADVERTISE_PACKAGES.find((p) => p.id === packageId) ?? ADVERTISE_PACKAGES[0];
  const amountKes = advertisePackagePrice(packageId);
  const refQuery = ref ? `&ref=${ref}` : "";
  const checkoutPath = `/advertise/pay?package=${packageId}${refQuery}`;

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-lg px-5 py-12">
        <Link to="/advertise" className="text-sm text-primary">
          ← Advertising packages
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold">Complete your campaign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pkg.name} · {pkg.placement} · {formatKes(amountKes)}/month
        </p>
        <div className="mt-8">
          <CheckoutFlow
            checkoutPath={checkoutPath}
            lineItem={{
              title: `NyumbaSearch — ${pkg.name}`,
              subtitle: pkg.placement,
              amountKes,
            }}
            metadata={{
              paymentType: "invoice",
            }}
            defaultPhone={(user?.user_metadata?.phone as string | undefined) ?? user?.phone ?? ""}
            allowQuarterly={false}
            onSuccess={() => {}}
          />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Payments via M-Pesa (Safaricom) or card through Pesapal. No PayPal — funds settle to
          NyumbaSearch&apos;s registered M-Pesa paybill.
        </p>
      </main>
    </PublicPageShell>
  );
}
