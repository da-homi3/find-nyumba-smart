import { Link } from "@tanstack/react-router";
import { PlanCards } from "@/components/PlanCards";
import { PORTAL_PLANS, PORTAL_UPGRADE_PLAN } from "@/lib/revenue/plans";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";

const PORTAL_PLAN_COPY: Record<ListingPortal, { title: string; subtitle: string }> = {
  landlord: {
    title: "Your landlord plan",
    subtitle: "You're on Free. Upgrade for more listings, full analytics, and featured placement.",
  },
  manager: {
    title: "Your management plan",
    subtitle:
      "You're on Free. Upgrade to manage more units across client portfolios with team access and reports.",
  },
  agency: {
    title: "Your agency plan",
    subtitle:
      "You're on Free. Upgrade for unlimited listings, team seats, and priority placement across your agency.",
  },
};

export function PortalPlanPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const plans = PORTAL_PLANS[portal];
  const upgradePlan = PORTAL_UPGRADE_PLAN[portal];
  const copy = PORTAL_PLAN_COPY[portal];

  return (
    <div className="max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
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
