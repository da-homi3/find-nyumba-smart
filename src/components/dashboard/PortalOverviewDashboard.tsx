import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  Crown,
  Eye,
  Plug,
  Plus,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { DashboardListingCard } from "@/components/dashboard/DashboardListingCard";
import { EmptyState } from "@/components/EmptyState";
import {
  listMyViewings,
  updateViewingStatus,
  type ViewingListItem,
} from "@/lib/api/booking.functions";
import { PORTAL_PATHS } from "@/lib/portal-paths";
import { PortalTrialBanner } from "@/components/dashboard/portal/PortalTrialBanner";
import { formatKes, type Property } from "@/lib/properties";
import { viewingStatusTone } from "@/lib/utils";
import { useOrgMembership } from "@/hooks/use-org-membership";

type PortalKind = "agency" | "manager";

type Props = Readonly<{
  portal: PortalKind;
  welcomeName: string;
  properties: Property[];
  leadsCount: number;
  newLeadsCount?: number;
  totalViews?: number;
  propertiesPath: "/agency/properties" | "/manager/properties";
  propertiesNewPath: "/agency/properties/new" | "/manager/properties/new";
  leadsPath: "/agency/leads" | "/manager/leads";
  teamPath: "/agency/team" | "/manager/team";
}>;

export function PortalOverviewDashboard({
  portal,
  welcomeName,
  properties,
  leadsCount,
  newLeadsCount = 0,
  totalViews = 0,
  propertiesPath,
  propertiesNewPath,
  leadsPath: _leadsPath,
  teamPath,
}: Props) {
  const qc = useQueryClient();
  const { isOwner, isMember } = useOrgMembership();
  const activeProperties = properties.filter((p) => p.is_active).length;
  const potentialRevenue = properties
    .filter((p) => p.is_active)
    .reduce((sum, p) => sum + (p.rent_kes ?? 0), 0);

  const { data: viewings = [] } = useQuery({
    queryKey: [`${portal}-viewings`],
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
      toast.success("Viewing status updated");
      void qc.invalidateQueries({ queryKey: [`${portal}-viewings`] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleHint = (() => {
    if (isOwner) return "Owner";
    if (isMember) return "Team member";
    return null;
  })();
  const paths = PORTAL_PATHS[portal];
  const showOwnerTools = !isMember;

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
            {roleHint ? ` · ${roleHint}` : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Welcome back, {welcomeName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardSettingsLink variant="pill" />
          <Link
            to={propertiesNewPath}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" /> Add property
          </Link>
        </div>
      </header>

      <PortalTrialBanner portal={portal} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Building2}
          label="Total Properties"
          value={String(properties.length)}
          hint={`${activeProperties} active`}
        />
        <Kpi
          icon={Eye}
          label="Property Views"
          value={totalViews.toLocaleString()}
          hint="portfolio"
        />
        <Kpi
          icon={Users}
          label="Tenant Leads"
          value={String(leadsCount)}
          hint={`${newLeadsCount} new`}
        />
        <Kpi
          icon={TrendingUp}
          label="Monthly Revenue"
          value={formatKes(potentialRevenue)}
          hint="potential"
        />
      </div>

      {showOwnerTools && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Same portfolio tools as the landlord dashboard — import listings, connect your CRM, and
            manage your plan.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ToolCard
              to={paths.import}
              icon={Upload}
              title="Bulk import"
              description="Upload a CSV to create draft listings in one go."
            />
            <ToolCard
              to={paths.integrations}
              icon={Plug}
              title="API & integrations"
              description="Create API keys and connect your property system."
            />
            <ToolCard
              to={paths.plan}
              icon={Crown}
              title="Plan"
              description="See your plan limits and upgrade for more listings."
            />
            <ToolCard
              to={paths.billing}
              icon={CreditCard}
              title="Billing"
              description="Invoices, lead packs, and payment history."
            />
          </div>
        </section>
      )}

      {isOwner ? (
        <section className="mt-8 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Users className="h-5 w-5 text-primary" />
                Team access
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Invite staff by email and approve them before they can open this dashboard. Approved
                members can manage listings and leads with limited permissions.
              </p>
            </div>
            <Link
              to={teamPath}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Manage team →
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
          You have team-member access. You can manage properties and leads, but only the owner can
          invite or approve staff.
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Your properties</h2>
            <Link to={propertiesPath} className="text-sm font-medium text-primary">
              Manage all →
            </Link>
          </div>

          {properties.length === 0 ? (
            <EmptyState
              type="no_listings"
              className="mt-4"
              href={propertiesNewPath}
              cta="Add your first property"
            />
          ) : (
            <div className="mt-4 space-y-3">
              {properties.slice(0, 8).map((p) => (
                <DashboardListingCard
                  key={p.id}
                  listing={p}
                  portal={portal === "agency" ? "agency" : "manager"}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="flex items-center gap-1 font-display text-xl font-semibold">
            <Calendar className="h-5 w-5 text-primary" />
            Viewing Requests
          </h2>
          {viewings.length === 0 ? (
            <EmptyState
              type="no_leads"
              className="mt-4 p-6"
              href={paths.plan}
              cta="View plan options"
            />
          ) : (
            <div className="mt-4 space-y-3">
              {viewings.slice(0, 6).map((v: ViewingListItem) => (
                <div key={v.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <strong className="block text-xs font-semibold">{v.properties?.title}</strong>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    Tenant: {v.tenant_profile?.full_name ?? "Anonymous Tenant"}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    Schedule: {new Date(v.scheduled_at).toLocaleString()}
                  </span>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${viewingStatusTone(v.status)}`}
                  >
                    {v.status.toUpperCase()}
                  </span>
                  {v.status === "pending" && (
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "cancelled" })}
                        className="rounded-lg border border-red-500/20 p-1 text-red-500 hover:bg-red-500/10"
                        aria-label="Decline viewing"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "confirmed" })}
                        className="rounded-lg border border-emerald-500/20 p-1 text-emerald-600 hover:bg-emerald-500/10"
                        aria-label="Confirm viewing"
                      >
                        <Check className="h-4 w-4" />
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
    <div className="glass-card rounded-2xl p-5 shadow-soft transition hover:border-primary/25">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ToolCard({
  to,
  icon: Icon,
  title,
  description,
}: Readonly<{
  to: string;
  icon: typeof Upload;
  title: string;
  description: string;
}>) {
  return (
    <Link
      to={to}
      className="glass-card rounded-2xl p-5 shadow-soft transition hover:border-primary/40 hover:shadow-elegant"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs font-semibold text-primary">Open →</p>
    </Link>
  );
}
