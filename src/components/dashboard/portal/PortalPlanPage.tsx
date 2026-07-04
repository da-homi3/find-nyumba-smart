import { Link } from "@tanstack/react-router";
import { PlanCards } from "@/components/PlanCards";
import { AGENCY_PLANS, LANDLORD_PLANS } from "@/lib/revenue/plans";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";

export function PortalPlanPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const plans = portal === "agency" ? AGENCY_PLANS : LANDLORD_PLANS;
  const upgradePlan = portal === "agency" ? "agency-pro" : "pro";

  return (
    <div className="max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">Your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;re on Free. Upgrade for more listings, analytics, and featured placement.
      </p>
      <div className="mt-8">
        <PlanCards plans={plans} showCta={false} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={paths.checkout}
          search={{ plan: upgradePlan }}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Upgrade
        </Link>
        <Link
          to="/pricing"
          className="rounded-xl border px-6 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Compare all plans
        </Link>
        <Link
          to={paths.billing}
          className="rounded-xl border px-6 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Billing & invoices
        </Link>
      </div>
    </div>
  );
}
