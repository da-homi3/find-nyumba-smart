import { Link } from "@tanstack/react-router";
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
    <section className="mt-6 overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-primary/15 via-primary/5 to-transparent p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" />
            Full pilot participant
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold">
            {partner
              ? `${partner} — complimentary pilot access is active`
              : "Your complimentary pilot access is active"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You are a full partner in the NyumbaSearch pilot. Listing, bulk import, and lead
            contacts are unlocked at no charge
            {days != null ? ` for ${days} more day${days === 1 ? "" : "s"}` : ""}
            {endLabel ? ` (until ${endLabel})` : ""}. No subscription is required during this
            window.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <span className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
            Status · Active
          </span>
          {days != null ? (
            <span className="text-sm font-medium tabular-nums text-foreground">
              {days} day{days === 1 ? "" : "s"} remaining
            </span>
          ) : null}
          <Link
            to="/partner"
            className="inline-flex items-center justify-center rounded-xl border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Open pilot dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
