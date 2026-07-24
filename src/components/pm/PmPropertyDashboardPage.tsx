import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { formatKes } from "@/lib/properties";
import { getPmProperty, getPmPropertyDashboard } from "@/lib/api/pm.functions";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";

const MAINTENANCE_TO = {
  landlord: "/landlord/manage/$propertyId/maintenance",
  agency: "/agency/manage/$propertyId/maintenance",
  manager: "/manager/manage/$propertyId/maintenance",
} as const;

export function PmPropertyDashboardPage({
  portal,
  propertyId,
}: Readonly<{
  portal: PmPortal;
  propertyId: string;
}>) {
  const detail = useQuery({
    queryKey: ["pm-property", propertyId],
    queryFn: () => getPmProperty({ data: { propertyId } }),
  });
  const dash = useQuery({
    queryKey: ["pm-dashboard", propertyId],
    queryFn: () => getPmPropertyDashboard({ data: { propertyId } }),
  });

  if (detail.isLoading || dash.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="px-4 py-8 text-sm text-destructive">
        {(detail.error as Error)?.message ?? "Property not found"}
      </div>
    );
  }

  const { property } = detail.data;
  const d = dash.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">{property.name}</h1>
      <p className="text-sm text-muted-foreground">
        {property.neighborhood} · {property.address}
      </p>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="overview" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Occupancy"
          value={`${d?.occupancyRate ?? 0}%`}
          hint={`${d?.occupiedUnits ?? 0}/${d?.totalUnits ?? 0} occupied`}
        />
        <Stat label="Expected this month" value={formatKes(d?.expectedIncome ?? 0)} />
        <Stat label="Collected" value={formatKes(d?.collectedThisMonth ?? 0)} />
        <Stat label="Outstanding" value={formatKes(d?.outstandingRent ?? 0)} />
        <Link
          to={MAINTENANCE_TO[portal]}
          params={{ propertyId }}
          className="block rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary/40"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Open maintenance
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {String(d?.openMaintenanceRequests ?? 0)}
          </p>
        </Link>
        <Stat label="Vacant units" value={String(d?.vacantUnits ?? 0)} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Leases ending within 30 days
        </h2>
        {(d?.upcomingLeaseExpirations?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None upcoming.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {d!.upcomingLeaseExpirations.map((row) => (
              <li
                key={`${row.unit_label}-${row.end_date}`}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Unit {row.unit_label} · {row.full_name} · ends {row.end_date}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
