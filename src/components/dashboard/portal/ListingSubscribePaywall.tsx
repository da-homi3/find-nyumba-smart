import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { PORTAL_UPGRADE_PLAN } from "@/lib/revenue/plans";

export function ListingSubscribePaywall({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const plan = PORTAL_UPGRADE_PLAN[portal];

  return (
    <div className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <Crown className="h-4 w-4" />
        Subscription required
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold">Subscribe to list properties</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Public listings require a paid plan. Free accounts can use the dashboard after approval, but
        cannot publish or import listings until they subscribe.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={`${paths.checkout}?plan=${plan}`}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-emerald px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant"
        >
          Subscribe
        </a>
        <Link
          to={paths.plan}
          className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}
