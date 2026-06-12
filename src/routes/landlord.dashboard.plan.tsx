import { createFileRoute, Link } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PlanCards } from "@/components/PlanCards";
import { LANDLORD_PLANS } from "@/lib/revenue/plans";

export const Route = createFileRoute("/landlord/dashboard/plan")({
  component: () => (
    <LandlordShell>
      <PlanPage />
    </LandlordShell>
  ),
});

function PlanPage() {
  return (
    <div className="max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">Your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;re on Free. Upgrade for more listings, analytics, and featured placement.
      </p>
      <div className="mt-8">
        <PlanCards plans={LANDLORD_PLANS} showCta={false} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/landlord/checkout"
          search={{ plan: "pro" }}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Upgrade to Pro
        </Link>
        <Link
          to="/pricing"
          className="rounded-xl border px-6 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Compare all plans
        </Link>
        <Link
          to="/landlord/dashboard/billing"
          className="rounded-xl border px-6 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Billing & invoices
        </Link>
      </div>
    </div>
  );
}
