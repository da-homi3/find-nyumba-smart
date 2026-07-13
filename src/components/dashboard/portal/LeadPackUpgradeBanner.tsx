import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";

export function LeadPackUpgradeBanner({ portal }: Readonly<{ portal: ListingPortal }>) {
  const { entitlements, loading } = useEntitlements();
  const paths = PORTAL_PATHS[portal];

  if (loading || entitlements.canViewLeadContacts !== false) return null;

  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
      <Lock className="h-4 w-4 shrink-0" />
      <span>
        During your free trial, buy a lead pack to unlock tenant phone numbers and contacts.
      </span>
      <Link
        to={paths.checkout}
        search={{ product: "leads", qty: 25 }}
        className="font-semibold underline"
      >
        Buy leads
      </Link>
    </p>
  );
}
