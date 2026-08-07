import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import { useProfilePhone } from "@/hooks/use-profile-phone";
import { supabase } from "@/integrations/supabase/client";
import {
  LEAD_PACKS,
  PORTAL_PLANS,
  REPORT_CATALOG,
  planMonthlyPrice,
  resolvePortalPlan,
} from "@/lib/revenue/plans";
import { EARLY_PARTNER_SUBSCRIPTION_DISCOUNT, isEarlyPartnerStatus } from "@/lib/promo/constants";
import { formatKes } from "@/lib/properties";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { useEffect } from "react";

export type PortalCheckoutSearch = {
  plan?: string;
  product?: string;
  qty?: number;
  reportType?: string;
};

export function PortalCheckoutPage({
  portal,
  search,
}: Readonly<{ portal: ListingPortal; search: PortalCheckoutSearch }>) {
  const paths = PORTAL_PATHS[portal];
  const { user, loading } = useAuth();
  const { phone: profilePhone } = useProfilePhone();
  const navigate = useNavigate();
  const { plan, product, qty, reportType } = search;

  const foundingQ = useQuery({
    queryKey: ["founding-member-status", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("founding_member_status")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.founding_member_status ?? "none";
    },
  });

  const earlyPartner = isEarlyPartnerStatus(foundingQ.data);
  const discountPct = Math.round(EARLY_PARTNER_SUBSCRIPTION_DISCOUNT * 100);

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

  const defaultPhone = profilePhone ?? "";

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

  const listPrice = planMonthlyPrice(planId, "monthly");
  const amountKes = planMonthlyPrice(planId, "monthly", { earlyPartner });

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-2xl font-semibold">Upgrade your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">{planDef.name}</p>
      {earlyPartner ? (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">Early partner discount:</span> {discountPct}%
          off subscriptions ({formatKes(listPrice)} → {formatKes(amountKes)} / month).
        </div>
      ) : null}
      <div className="mt-8">
        <CheckoutFlow
          checkoutPath={`${paths.checkout}?plan=${planId}`}
          lineItem={{
            title: planDef.name,
            subtitle: earlyPartner
              ? `${planDef.desc} · Early partner ${discountPct}% off`
              : planDef.desc,
            amountKes,
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
