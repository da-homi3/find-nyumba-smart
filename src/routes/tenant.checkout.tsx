import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { useAuth } from "@/hooks/use-auth";
import { useProfilePhone } from "@/hooks/use-profile-phone";
import { useQuery } from "@tanstack/react-query";
import { PLUS_PLAN } from "@/lib/revenue/plans";
import { TenantPlusOfferCards } from "@/components/TenantPlusOfferCards";
import { getPlusPricingPublic } from "@/lib/api/revenue.functions";
import { recordProductEvent } from "@/lib/api/analytics.functions";

const searchSchema = z.object({
  plan: z.string().optional(),
});

export const Route = createFileRoute("/tenant/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => (
    <RouteErrorBoundary title="Checkout failed to load">
      <TenantCheckoutPage />
    </RouteErrorBoundary>
  ),
});

function TenantCheckoutPage() {
  const { user, loading } = useAuth();
  const { phone: profilePhone } = useProfilePhone();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<"monthly" | "quarterly">("quarterly");
  const { data: livePricing } = useQuery({
    queryKey: ["plus-pricing"],
    queryFn: () => getPlusPricingPublic(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: { redirect: "/tenant/checkout?plan=plus" } as never,
        replace: true,
      });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void recordProductEvent({ data: { eventName: "tenant_plus_viewed" } }).catch(() => undefined);
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-5 pt-16">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (!user) return null;

  const amountKes =
    cycle === "quarterly"
      ? (livePricing?.quarterlyKes ?? PLUS_PLAN.quarterlyKes)
      : (livePricing?.monthlyKes ?? PLUS_PLAN.monthlyKes);
  const features = livePricing?.features ?? PLUS_PLAN.features;
  const defaultPhone = profilePhone ?? "";

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-10">
      <h1 className="font-display text-2xl font-semibold">Tenant Plus</h1>
      <p className="mt-1 text-sm text-muted-foreground">Find it faster.</p>
      <div className="mt-6">
        <TenantPlusOfferCards selected={cycle} onSelect={setCycle} />
      </div>

      <div className="mt-8">
        <CheckoutFlow
          checkoutPath="/tenant/checkout?plan=plus"
          lineItem={{
            title: "NyumbaSearch Plus",
            subtitle: cycle === "quarterly" ? "3-month billing cycle" : "Monthly billing",
            amountKes: amountKes,
            features: features,
          }}
          metadata={{
            paymentType: "tenant_plus",
            plan: "plus",
            billingCycle: cycle,
          }}
          defaultPhone={defaultPhone}
          allowQuarterly={false}
          onSuccess={() => navigate({ to: "/tenant/saved" })}
        />
      </div>

      <Link to="/tenant" className="mt-6 block text-center text-sm text-primary">
        ← Back to search
      </Link>
    </div>
  );
}
