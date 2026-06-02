import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LandlordShell } from "@/components/LandlordShell";
import { getLandlordDashboard } from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, Eye, Home, Users } from "lucide-react";

export const Route = createFileRoute("/landlord/analytics")({
  component: () => (
    <LandlordShell>
      <AnalyticsPage />
    </LandlordShell>
  ),
});

function AnalyticsPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["landlord-dashboard", user?.id],
    enabled: !!user,
    queryFn: () => getLandlordDashboard(),
  });

  const properties = data?.properties ?? [];
  const stats = data?.stats;
  const maxViews = Math.max(1, ...properties.map((property) => property.views));

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real listing performance from tenant views and inquiries.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <MetricCard icon={Eye} label="Total views" value={stats?.totalViews ?? 0} />
        <MetricCard icon={Users} label="Tenant leads" value={stats?.totalLeads ?? 0} />
        <MetricCard icon={Home} label="Active listings" value={stats?.activeProperties ?? 0} />
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Views by listing</h2>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-6 grid gap-4">
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add listings to start collecting analytics.
            </p>
          ) : (
            properties.map((property) => (
              <div key={property.id}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="line-clamp-1 font-medium">{property.title}</span>
                  <span className="text-muted-foreground">{property.views} views</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-emerald"
                    style={{ width: `${Math.max(4, (property.views / maxViews) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
