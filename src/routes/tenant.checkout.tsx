import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import { PLUS_PLAN } from "@/lib/revenue/plans";
import { useEffect, useState } from "react";

const searchSchema = z.object({
  plan: z.string().optional(),
});

export const Route = createFileRoute("/tenant/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  component: TenantCheckoutPage,
});

function TenantCheckoutPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: { redirect: "/tenant/checkout?plan=plus" } as never,
        replace: true,
      });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-5 pt-16">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (!user) return null;

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-5 pt-16 text-center">
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
          NyumbaSearch Plus is active
        </p>
        <Link
          to="/tenant/saved"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Go to saved homes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 pt-10 pb-24">
      <h1 className="font-display text-2xl font-semibold">NyumbaSearch Plus</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Early access and unlimited search alerts.
      </p>
      <div className="mt-8">
        <CheckoutFlow
          lineItem={{
            title: "NyumbaSearch Plus",
            subtitle: "For serious house hunters in Nairobi",
            amountKes: PLUS_PLAN.monthlyKes,
            features: PLUS_PLAN.features,
          }}
          metadata={{ paymentType: "tenant_plus", plan: "plus" }}
          defaultPhone={user.phone ?? ""}
          onSuccess={() => setDone(true)}
        />
      </div>
    </div>
  );
}
