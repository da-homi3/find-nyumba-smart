import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LandlordShell } from "@/components/LandlordShell";
import { Building2, Eye, Users, TrendingUp, Plus } from "lucide-react";
import { getLandlordDashboard } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/landlord/dashboard")({
  component: () => (
    <LandlordShell>
      <Dashboard />
    </LandlordShell>
  ),
});

function Dashboard() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["landlord-dashboard", user?.id],
    enabled: !!user,
    queryFn: () => getLandlordDashboard(),
  });

  const properties = data?.properties ?? [];
  const stats = data?.stats ?? {
    totalProperties: 0,
    activeProperties: 0,
    totalViews: 0,
    totalLeads: 0,
    newLeads: 0,
    potentialRevenue: 0,
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Welcome back, landlord</h1>
        </div>
        <Link
          to="/landlord/properties/new"
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" /> Add property
        </Link>
      </header>

      {/* KPIs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Building2}
          label="Total Properties"
          value={String(stats.totalProperties)}
          hint={`${stats.activeProperties} active`}
        />
        <Kpi
          icon={Eye}
          label="Property Views"
          value={stats.totalViews.toLocaleString()}
          hint="last 30 days"
        />
        <Kpi
          icon={Users}
          label="Tenant Leads"
          value={String(stats.totalLeads)}
          hint={`${stats.newLeads} new`}
        />
        <Kpi
          icon={TrendingUp}
          label="Monthly Revenue"
          value={formatKes(stats.potentialRevenue)}
          hint="potential"
        />
      </div>

      {/* My properties */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Your properties</h2>
          <Link to="/landlord/properties" className="text-sm font-medium text-primary">
            Manage all →
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed bg-card p-10 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">No properties yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first listing to start receiving tenant leads.
            </p>
            <Link
              to="/landlord/properties/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-emerald px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Add your first property
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Property</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Rent</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.neighborhood}</td>
                    <td className="px-4 py-3">{formatKes(p.rent_kes)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="mt-3 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
