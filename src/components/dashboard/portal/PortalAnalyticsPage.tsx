import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  listAgencyProperties,
  listLandlordLeads,
  listLandlordProperties,
  listManagerProperties,
} from "@/lib/api/nyumba.functions";
import { getUserEntitlements, listLandlordLeadsPanel } from "@/lib/api/revenue.functions";
import { canViewLeadDetails } from "@/lib/revenue/entitlements";
import { LEAD_PACKS } from "@/lib/revenue/plans";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { useAuth } from "@/hooks/use-auth";
import { formatKes, type Property } from "@/lib/properties";
import { BarChart3, Download, Eye, Home, Lock, Users } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";

type LeadRow = Awaited<ReturnType<typeof listLandlordLeadsPanel>>[number];

async function listPortalProperties(portal: ListingPortal): Promise<Property[]> {
  if (portal === "manager") return listManagerProperties();
  if (portal === "agency") return listAgencyProperties();
  return listLandlordProperties();
}

export function PortalAnalyticsPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const { user } = useAuth();

  const { data: properties = [] } = useQuery({
    queryKey: [`${portal}-analytics-properties`, user?.id],
    enabled: !!user,
    queryFn: () => listPortalProperties(portal),
  });

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements", user?.id],
    enabled: !!user,
    queryFn: () => getUserEntitlements(),
  });

  const { data: panelLeads = [] } = useQuery({
    queryKey: [`${portal}-leads-panel`, user?.id],
    enabled: !!user,
    queryFn: () => listLandlordLeadsPanel(),
  });

  const { data: inquiryLeads = [] } = useQuery({
    queryKey: [`${portal}-leads-count`, user?.id],
    enabled: !!user,
    queryFn: () => listLandlordLeads(),
  });

  const activeProperties = properties.filter((p) => p.is_active).length;
  const totalViews = properties.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalLeads = Math.max(panelLeads.length, inquiryLeads.length);
  const maxViews = Math.max(1, ...properties.map((property) => property.views ?? 0));
  const plan = entitlements?.landlordPlan ?? "free";
  const showLeadDetails = canViewLeadDetails(plan);

  const exportAnalytics = () => {
    if (properties.length === 0) {
      toast.error("No listings to export");
      return;
    }
    downloadCsv(
      `listing-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Property", "Neighborhood", "Rent (KES)", "Views", "Active", "Verified"],
      properties.map((p) => [
        p.title,
        p.neighborhood,
        String(p.rent_kes),
        String(p.views),
        p.is_active ? "Yes" : "No",
        p.is_verified ? "Yes" : "No",
      ]),
    );
    toast.success("Analytics report downloaded");
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real listing performance from tenant views and inquiries.
          </p>
        </div>
        <button
          type="button"
          onClick={exportAnalytics}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <MetricCard icon={Eye} label="Total views" value={totalViews} />
        <MetricCard icon={Users} label="Tenant leads" value={totalLeads} />
        <MetricCard icon={Home} label="Active listings" value={activeProperties} />
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Lead inbox</h2>
          {!showLeadDetails && (
            <Link
              to={paths.checkout}
              search={{ plan: portal === "agency" ? "agency-pro" : "pro" }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Lock className="h-3.5 w-3.5" /> Upgrade to view contacts
            </Link>
          )}
        </div>
        {panelLeads.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Leads appear when tenants inquire on your listings.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {panelLeads.slice(0, 8).map((lead) => (
              <LeadRowItem key={lead.id} lead={lead} blurred={!showLeadDetails} />
            ))}
          </ul>
        )}
        {!showLeadDetails && (
          <div className="mt-6 rounded-xl border border-dashed bg-secondary/40 p-4">
            <p className="text-sm font-medium">Buy lead packs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pro includes lead details. Or purchase packs à la carte.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LEAD_PACKS.map((pack) => (
                <Link
                  key={pack.qty}
                  to={paths.checkout}
                  search={{ product: "leads", qty: pack.qty }}
                  className="rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                >
                  {pack.label} — {formatKes(pack.priceKes)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

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
                    style={{ width: `${Math.max(4, ((property.views ?? 0) / maxViews) * 100)}%` }}
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

function LeadRowItem({ lead, blurred }: Readonly<{ lead: LeadRow; blurred: boolean }>) {
  const property = lead.properties as { title?: string; neighborhood?: string } | null;
  const tenant = lead.profiles as { full_name?: string; phone?: string } | null;
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${blurred ? "select-none blur-[3px]" : ""}`}
    >
      <div>
        <p className="font-medium">{property?.title ?? "Listing"}</p>
        <p className="text-xs text-muted-foreground">
          {tenant?.full_name ?? "Tenant"} · {lead.source ?? "inquiry"}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">Score {lead.quality_score ?? "—"}</span>
    </li>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: Readonly<{
  icon: typeof Eye;
  label: string;
  value: number;
}>) {
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
