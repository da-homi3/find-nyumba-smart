import { Link } from "@tanstack/react-router";
import { PlanCards } from "@/components/PlanCards";
import { PORTAL_PLANS, PORTAL_UPGRADE_PLAN } from "@/lib/revenue/plans";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { useEntitlements } from "@/hooks/use-entitlements";

const PORTAL_PLAN_COPY: Record<ListingPortal, { title: string; subtitle: string }> = {
  landlord: {
    title: "Your landlord plan",
    subtitle: "Manage listings, analytics, and billing from one place.",
  },
  manager: {
    title: "Your management plan",
    subtitle: "Manage units across client portfolios with team access and reports.",
  },
  agency: {
    title: "Your agency plan",
    subtitle: "Team seats, listings, and priority placement for your agency.",
  },
};

function formatTrialEnd(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalPlanPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const plans = PORTAL_PLANS[portal];
  const upgradePlan = PORTAL_UPGRADE_PLAN[portal];
  const copy = PORTAL_PLAN_COPY[portal];

  const { entitlements } = useEntitlements();

  const isTrialing = entitlements.portalSubscriptionStatus === "trialing";
  const isActive = entitlements.portalSubscriptionStatus === "active";
  const planName =
    plans.find((p) => p.id === entitlements.landlordPlan)?.name ?? entitlements.landlordPlan;
  const trialEndLabel = formatTrialEnd(entitlements.portalTrialEndsAt);

  return (
    <div className="max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

      <div className="mt-6 rounded-2xl border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Current plan
        </p>
        <p className="mt-1 font-display text-xl font-semibold">{planName}</p>
        {isTrialing && trialEndLabel && (
          <p className="mt-2 text-sm text-muted-foreground">
            Free trial active until {trialEndLabel}. Full dashboard access is included — lead
            contact details require a lead pack or your first paid month.
          </p>
        )}
        {isActive && (
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription is active. Lead contact details are included in your plan.
          </p>
        )}
        {!isTrialing && !isActive && entitlements.landlordPlan === "free" && (
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re on Free. Upgrade for more listings, full analytics, and lead access.
          </p>
        )}
        {entitlements.leadPackBalance ? (
          <p className="mt-2 text-sm font-medium text-primary">
            {entitlements.leadPackBalance} lead pack credits remaining
          </p>
        ) : null}
      </div>

      <div className="mt-8">
        <PlanCards plans={plans} showCta={false} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {!isTrialing && !isActive && (
          <Link
            to={paths.checkout}
            search={{ plan: upgradePlan }}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Upgrade
          </Link>
        )}
        <Link
          to={paths.checkout}
          search={{ product: "leads", qty: 25 }}
          className="rounded-xl border px-6 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Buy lead pack
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
