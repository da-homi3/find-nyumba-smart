import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LandlordShell } from "@/components/LandlordShell";
import {
  Building2,
  Eye,
  Users,
  TrendingUp,
  Plus,
  Calendar,
  Check,
  X,
  KeyRound,
} from "lucide-react";
import { getLandlordDashboard } from "@/lib/api/nyumba.functions";
import {
  listMyViewings,
  updateViewingStatus,
  type ViewingListItem,
} from "@/lib/api/booking.functions";
import { formatKes } from "@/lib/properties";
import { viewingStatusTone } from "@/lib/utils";
import { toast } from "sonner";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { DashboardListingCard } from "@/components/dashboard/DashboardListingCard";
import { EmptyState } from "@/components/EmptyState";
import { PortalTrialBanner } from "@/components/dashboard/portal/PortalTrialBanner";
import { LeadPackUpgradeBanner } from "@/components/dashboard/portal/LeadPackUpgradeBanner";

export const Route = createFileRoute("/landlord/dashboard/")({
  component: () => (
    <LandlordShell>
      <Dashboard />
    </LandlordShell>
  ),
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["landlord-dashboard", user?.id],
    enabled: !!user,
    queryFn: () => getLandlordDashboard(),
  });

  // Fetch viewings (which act as leads/viewing requests)
  const { data: viewings = [] } = useQuery({
    queryKey: ["landlord-viewings", user?.id],
    enabled: !!user,
    queryFn: () => listMyViewings(),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "confirmed" | "cancelled" | "completed";
    }) => {
      await updateViewingStatus({ data: { viewingId: id, status } });
    },
    onSuccess: () => {
      toast.success("Viewing status updated!");
      qc.invalidateQueries({ queryKey: ["landlord-viewings"] });
      qc.invalidateQueries({ queryKey: ["landlord-dashboard"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
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
    <div className="px-6 py-8 lg:px-10 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Welcome back, landlord</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardSettingsLink variant="pill" />
          <Link
            to="/landlord/properties/new"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" /> Add property
          </Link>
        </div>
      </header>

      <PortalTrialBanner portal="landlord" />

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

      <section className="mt-8 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <KeyRound className="h-5 w-5 text-primary" />
              Caretaker access
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Add caretaker phone numbers and PINs so on-site staff can log vacancies and updates at{" "}
              <Link to="/caretaker" className="font-medium text-primary">
                nyumbasearch.com/caretaker
              </Link>
              .
            </p>
          </div>
          <Link
            to="/landlord/caretakers"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Manage caretakers →
          </Link>
        </div>
      </section>

      {/* Main Grid */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Left column: properties */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Your properties</h2>
            <Link to="/landlord/properties" className="text-sm font-medium text-primary">
              Manage all →
            </Link>
          </div>

          {properties.length === 0 ? (
            <EmptyState type="no_listings" className="mt-4" />
          ) : (
            <div className="mt-4 space-y-3">
              {properties.map((p) => (
                <DashboardListingCard key={p.id} listing={p} portal="landlord" />
              ))}
            </div>
          )}
        </div>

        {/* Right column: viewing bookings queue / leads */}
        <div>
          <h2 className="font-display text-xl font-semibold flex items-center gap-1">
            <Calendar className="h-5 w-5 text-primary" />
            Viewing Requests
          </h2>
          <LeadPackUpgradeBanner portal="landlord" />
          {viewings.length === 0 ? (
            <EmptyState type="no_leads" className="mt-4 p-6" href="/landlord/boost" />
          ) : (
            <div className="mt-4 space-y-3">
              {viewings.map((v: ViewingListItem) => (
                <div key={v.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-xs font-semibold block">{v.properties?.title}</strong>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Tenant: {v.tenant_profile?.full_name ?? "Anonymous Tenant"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Schedule: {new Date(v.scheduled_at).toLocaleString()}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold mt-2 ${viewingStatusTone(v.status)}`}
                      >
                        {v.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {v.status === "pending" && (
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "cancelled" })}
                        className="rounded-lg border border-red-500/20 text-red-500 p-1 hover:bg-red-500/10"
                        aria-label="Decline viewing"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "confirmed" })}
                        className="rounded-lg bg-gradient-emerald text-primary-foreground p-1 shadow-soft hover:opacity-90"
                        aria-label="Accept viewing"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {v.status === "confirmed" && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "completed" })}
                        className="rounded-lg border px-2 py-1 text-[10px] font-semibold hover:bg-secondary"
                      >
                        Mark viewing completed
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: Readonly<{
  icon: typeof Building2;
  label: string;
  value: string;
  hint: string;
}>) {
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
