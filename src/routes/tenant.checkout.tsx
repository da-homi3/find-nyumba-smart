import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import { PLUS_PLAN } from "@/lib/revenue/plans";

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
  const [cycle, setCycle] = useState<"monthly" | "quarterly">("monthly");

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

  const amountKes = cycle === "quarterly" ? PLUS_PLAN.quarterlyKes : PLUS_PLAN.monthlyKes;
  const defaultPhone = (user.user_metadata?.phone as string | undefined) ?? user.phone ?? "";

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-10">
      <h1 className="font-display text-2xl font-semibold">NyumbaSearch Plus</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Unlimited contact unlocks, in-app messaging, and scam-risk scores.
      </p>
      <p className="mt-2 text-sm font-medium text-emerald-600">
        First month free for new subscribers — no payment today.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setCycle("monthly")}
          className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${
            cycle === "monthly" ? "border-primary bg-primary/10 text-primary" : ""
          }`}
        >
          Monthly — KES {PLUS_PLAN.monthlyKes}
        </button>
        <button
          type="button"
          onClick={() => setCycle("quarterly")}
          className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${
            cycle === "quarterly" ? "border-primary bg-primary/10 text-primary" : ""
          }`}
        >
          3 months — KES {PLUS_PLAN.quarterlyKes}
        </button>
      </div>

      <div className="mt-8">
        <CheckoutFlow
          checkoutPath="/tenant/checkout?plan=plus"
          lineItem={{
            title: "NyumbaSearch Plus",
            subtitle: cycle === "quarterly" ? "3-month billing cycle" : "Monthly billing",
            amountKes: amountKes,
            features: PLUS_PLAN.features,
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
