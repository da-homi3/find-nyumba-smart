import { Link, useNavigate } from "@tanstack/react-router";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import {
  LEAD_PACKS,
  PORTAL_PLANS,
  REPORT_CATALOG,
  planMonthlyPrice,
  resolvePortalPlan,
} from "@/lib/revenue/plans";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export type PortalCheckoutSearch = {
  plan?: string;
  product?: string;
  qty?: number;
  reportType?: string;
};

function profilePhone(user: User): string {
  const meta = user.user_metadata;
  if (meta && typeof meta === "object" && "phone" in meta && typeof meta.phone === "string") {
    return meta.phone;
  }
  return user.phone ?? "";
}

export function PortalCheckoutPage({
  portal,
  search,
}: Readonly<{ portal: ListingPortal; search: PortalCheckoutSearch }>) {
  const paths = PORTAL_PATHS[portal];
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plan, product, qty, reportType } = search;

  useEffect(() => {
    if (!loading && !user) {
      const params = new URLSearchParams();
      if (plan) params.set("plan", plan);
      if (product) params.set("product", product);
      if (qty) params.set("qty", String(qty));
      if (reportType) params.set("reportType", reportType);
      navigate({
        to: "/auth",
        search: { redirect: `${paths.checkout}?${params.toString()}` },
        replace: true,
      });
    }
  }, [loading, user, navigate, plan, product, qty, reportType, paths.checkout]);

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
            checkoutPath={`${paths.checkout}?product=report&reportType=${report.id}`}
            lineItem={{
              title: report.name,
              subtitle: report.description,
              amountKes: report.priceKes,
            }}
            metadata={{ paymentType: "report", reportType: report.id }}
            defaultPhone={defaultPhone}
            allowQuarterly={false}
            onSuccess={() => navigate({ to: paths.dashboard })}
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
          checkoutPath={`${paths.checkout}?product=leads&qty=${pack.qty}`}
          lineItem={{
            title: pack.label,
            subtitle: "Verified tenant leads for your listings",
            amountKes: pack.priceKes,
          }}
          metadata={{ paymentType: "lead_pack", qty: pack.qty }}
          defaultPhone={defaultPhone}
          allowQuarterly={false}
          onSuccess={() => navigate({ to: paths.dashboard })}
        />
        <Link to={paths.dashboard} className="mt-6 block text-center text-sm text-primary">
          Go to dashboard
        </Link>
      </div>
    );
  }

  const planId = resolvePortalPlan(portal, plan);
  const portalPlans = PORTAL_PLANS[portal];
  const planDef = portalPlans.find((p) => p.id === planId) ?? portalPlans[1] ?? portalPlans[0];
  if (!planDef) return null;

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-2xl font-semibold">Upgrade your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">{planDef.name}</p>
      <div className="mt-8">
        <CheckoutFlow
          checkoutPath={`${paths.checkout}?plan=${planId}`}
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
          onSuccess={() => navigate({ to: paths.plan })}
        />
      </div>
      <Link to={paths.plan} className="mt-6 block text-center text-sm text-primary">
        View your plan
      </Link>
    </div>
  );
}
