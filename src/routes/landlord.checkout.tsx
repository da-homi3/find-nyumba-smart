import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { LandlordShell } from "@/components/LandlordShell";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import {
  AGENCY_PLANS,
  LANDLORD_PLANS,
  LEAD_PACKS,
  REPORT_CATALOG,
  planMonthlyPrice,
  resolveLandlordPlan,
} from "@/lib/revenue/plans";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

const searchSchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  qty: z.coerce.number().optional(),
  reportType: z.string().optional(),
});

export const Route = createFileRoute("/landlord/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => (
    <LandlordShell>
      <LandlordCheckoutPage />
    </LandlordShell>
  ),
});

function profilePhone(user: User): string {
  const meta = user.user_metadata;
  if (meta && typeof meta === "object" && "phone" in meta && typeof meta.phone === "string") {
    return meta.phone;
  }
  return user.phone ?? "";
}

function LandlordCheckoutPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plan, product, qty, reportType } = Route.useSearch();

  useEffect(() => {
    if (!loading && !user) {
      const params = new URLSearchParams();
      if (plan) params.set("plan", plan);
      if (product) params.set("product", product);
      if (qty) params.set("qty", String(qty));
      if (reportType) params.set("reportType", reportType);
      navigate({
        to: "/auth",
        search: { redirect: `/landlord/checkout?${params.toString()}` },
        replace: true,
      });
    }
  }, [loading, user, navigate, plan, product, qty, reportType]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (!user) return null;

  const defaultPhone = profilePhone(user);

  if (product === "report") {
    const report =
      REPORT_CATALOG.find((r) => r.id === (reportType ?? "quarterly-overview")) ??
      REPORT_CATALOG[0];
    if (!report) return null;
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">Market report</h1>
        <div className="mt-8">
          <CheckoutFlow
            checkoutPath={`/landlord/checkout?product=report&reportType=${report.id}`}
            lineItem={{
              title: report.name,
              subtitle: report.description,
              amountKes: report.priceKes,
            }}
            metadata={{ paymentType: "report", reportType: report.id }}
            defaultPhone={defaultPhone}
            allowQuarterly={false}
            onSuccess={() => navigate({ to: "/landlord/dashboard" })}
          />
        </div>
        <Link to="/pricing" className="mt-6 block text-center text-sm text-primary">
          ← Back to pricing
        </Link>
      </div>
    );
  }

  if (product === "leads" && qty) {
    const pack = LEAD_PACKS.find((p) => p.qty === qty) ?? LEAD_PACKS[1];
    if (!pack) return null;
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">Buy lead pack</h1>
        <CheckoutFlow
          checkoutPath={`/landlord/checkout?product=leads&qty=${pack.qty}`}
          lineItem={{
            title: pack.label,
            subtitle: "Verified tenant leads for your listings",
            amountKes: pack.priceKes,
          }}
          metadata={{ paymentType: "lead_pack", qty: pack.qty }}
          defaultPhone={defaultPhone}
          allowQuarterly={false}
          onSuccess={() => navigate({ to: "/landlord/dashboard" })}
        />
        <Link to="/landlord/dashboard" className="mt-6 block text-center text-sm text-primary">
          Go to dashboard
        </Link>
      </div>
    );
  }

  const planId = resolveLandlordPlan(plan);
  const allPlans = [...LANDLORD_PLANS, ...AGENCY_PLANS];
  const planDef = allPlans.find((p) => p.id === planId) ?? LANDLORD_PLANS[1];
  if (!planDef) return null;

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-2xl font-semibold">Upgrade your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">{planDef.name}</p>
      <div className="mt-8">
        <CheckoutFlow
          checkoutPath={`/landlord/checkout?plan=${planId}`}
          lineItem={{
            title: planDef.name,
            subtitle: planDef.desc,
            amountKes: planMonthlyPrice(planId, "monthly"),
            features: planDef.features,
          }}
          metadata={{
            paymentType: "landlord_plan",
            plan: planId,
          }}
          defaultPhone={defaultPhone}
          onSuccess={() => navigate({ to: "/landlord/dashboard/plan" })}
        />
      </div>
      <Link to="/landlord/dashboard/plan" className="mt-6 block text-center text-sm text-primary">
        View your plan
      </Link>
    </div>
  );
}
