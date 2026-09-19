import { Sparkles } from "lucide-react";
import { useEntitlements } from "@/hooks/use-entitlements";

function formatPilotEnd(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = iso.includes("T") ? new Date(iso) : new Date(`${iso}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalPilotBanner() {
  const { entitlements, loading } = useEntitlements();
  if (loading || !entitlements.pilotActive) return null;

  const endLabel = formatPilotEnd(entitlements.pilotEndsAt);
  const days = entitlements.pilotDaysRemaining;
  const partner = entitlements.pilotPartnerName;

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <Sparkles className="h-4 w-4" />
        Partner pilot — complimentary access
      </p>
      <h2 className="mt-2 font-display text-lg font-semibold">
        {partner ? `${partner} is on the NyumbaSearch pilot` : "You're on the NyumbaSearch pilot"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Listing, bulk import, and lead contacts are included at no charge
        {days != null ? ` for ${days} more day${days === 1 ? "" : "s"}` : ""}
        {endLabel ? ` (until ${endLabel})` : ""}. You do not need to subscribe to publish homes during
        this window.
      </p>
    </section>
  );
}
