import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AgencyShell } from "@/components/AgencyShell";
import { listAgencyProperties, listLandlordLeads } from "@/lib/api/nyumba.functions";
import { Building2, Inbox } from "lucide-react";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";

export const Route = createFileRoute("/agency/dashboard")({
  head: () => ({ meta: [{ title: "Agency dashboard — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <AgencyDashboard />
    </AgencyShell>
  ),
});

function AgencyDashboard() {
  const { data: properties = [] } = useQuery({
    queryKey: ["agency-properties"],
    queryFn: () => listAgencyProperties(),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["agency-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const active = properties.filter((p) => p.is_active).length;
  const vacant = properties.filter((p) => p.is_vacant !== false).length;

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Agency dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Portfolio-wide listings and leads</p>
        </div>
        <DashboardSettingsLink variant="pill" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total listings" value={String(properties.length)} icon={Building2} />
        <Stat label="Active listings" value={String(active)} icon={Building2} />
        <Stat label="Open leads" value={String(leads.length)} icon={Inbox} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Vacant units (tracked)</p>
          <p className="mt-1 font-display text-2xl font-semibold">{vacant}</p>
        </div>
        <Link
          to="/agency/properties/new"
          className="flex items-center justify-center rounded-2xl border-2 border-dashed bg-card p-5 text-sm font-semibold text-primary"
        >
          + Add new listing
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: Readonly<{
  label: string;
  value: string;
  icon: typeof Building2;
}>) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
