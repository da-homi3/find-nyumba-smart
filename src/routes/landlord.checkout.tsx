import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { LandlordShell } from "@/components/LandlordShell";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import {
  AGENCY_PLANS,
  LANDLORD_PLANS,
  LEAD_PACKS,
  planMonthlyPrice,
  resolveLandlordPlan,
} from "@/lib/revenue/plans";
import { useEffect } from "react";

const searchSchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  qty: z.coerce.number().optional(),
});

export const Route = createFileRoute("/landlord/checkout")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => (
    <LandlordShell>
      <LandlordCheckoutPage />
    </LandlordShell>
  ),
});

function LandlordCheckoutPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plan, product, qty } = Route.useSearch();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = `/landlord/checkout?plan=${plan ?? "pro"}${product ? `&product=${product}` : ""}${qty ? `&qty=${qty}` : ""}`;
      navigate({ to: "/auth", search: { redirect } as never, replace: true });
    }
  }, [loading, user, navigate, plan, product, qty]);

  if (loading || !user) return null;

  const planId = resolveLandlordPlan(plan);
  const allPlans = [...LANDLORD_PLANS, ...AGENCY_PLANS];
  const planDef = allPlans.find((p) => p.id === planId) ?? LANDLORD_PLANS[1];

  if (product === "leads" && qty) {
    const pack = LEAD_PACKS.find((p) => p.qty === qty) ?? LEAD_PACKS[1];
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">Buy lead pack</h1>
        <CheckoutFlow
          lineItem={{
            title: pack.label,
            subtitle: "Verified tenant leads for your listings",
            amountKes: pack.priceKes,
          }}
          metadata={{ paymentType: "lead_pack", qty: pack.qty }}
          defaultPhone={user.phone ?? ""}
          allowQuarterly={false}
          onSuccess={() => {}}
        />
        <Link to="/landlord/dashboard" className="mt-6 block text-center text-sm text-primary">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-2xl font-semibold">Upgrade your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">{planDef.name}</p>
      <div className="mt-8">
        <CheckoutFlow
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
          defaultPhone={user.phone ?? ""}
          onSuccess={() => {}}
        />
      </div>
      <Link to="/landlord/dashboard/plan" className="mt-6 block text-center text-sm text-primary">
        View your plan
      </Link>
    </div>
  );
}
