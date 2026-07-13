import { Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { PORTAL_PLANS } from "@/lib/revenue/plans";

function formatTrialEnd(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalTrialBanner({ portal }: Readonly<{ portal: ListingPortal }>) {
  const { entitlements, loading } = useEntitlements();
  const paths = PORTAL_PATHS[portal];

  if (loading || entitlements.portalSubscriptionStatus !== "trialing") return null;

  const planName =
    PORTAL_PLANS[portal].find((p) => p.id === entitlements.landlordPlan)?.name ??
    entitlements.landlordPlan;
  const trialEnd = formatTrialEnd(entitlements.portalTrialEndsAt);

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" />
            Free trial active
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold">
            You&apos;re on {planName} — full dashboard access included
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {trialEnd
              ? `Your trial runs until ${trialEnd}. After that, your plan renews automatically via M-Pesa unless you cancel.`
              : "Your 30-day trial includes listings, analytics, and portfolio tools."}{" "}
            Lead contact details require a lead pack during trial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={paths.plan}
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            <Crown className="h-4 w-4" />
            View plan
          </Link>
          <Link
            to={paths.checkout}
            search={{ product: "leads", qty: 25 }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Buy lead pack
          </Link>
        </div>
      </div>
    </section>
  );
}
