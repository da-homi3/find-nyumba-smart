import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Download, Eye, PhoneCall, Search, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { getAdminPlatformAnalytics } from "@/lib/api/admin.functions";

type AdminAnalytics = Awaited<ReturnType<typeof getAdminPlatformAnalytics>>;

function StatCard({
  label,
  value,
  hint,
  icon,
}: Readonly<{ label: string; value: string | number; hint?: string; icon: ReactNode }>) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TenantStatusBadge({ status }: Readonly<{ status: string }>) {
  let tone = "bg-muted text-muted-foreground";
  let label = "Inactive";
  if (status === "live_now") {
    tone = "bg-emerald-500/10 text-emerald-600";
    label = "Live now";
  } else if (status === "active_30d") {
    tone = "bg-amber-500/10 text-amber-600";
    label = "Active 30d";
  }
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function formatLastActivity(value: string | null) {
  if (!value) return "No recent activity";
  return `${formatDistanceToNow(new Date(value), { addSuffix: true })}`;
}

export function AdminAnalyticsTab({
  analytics,
  loading,
}: Readonly<{
  analytics: AdminAnalytics | undefined;
  loading: boolean;
}>) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-sm text-destructive">Analytics could not be loaded.</div>;
  }

  const topProperties = analytics.propertyTraffic.slice(0, 8);
  const topAreas = analytics.areaTraffic.slice(0, 8);
  const topTenants = analytics.tenantAccounts.slice(0, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Platform analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">{analytics.definitions.activeNow}</p>
        </div>
        <Link
          to="/admin"
          search={{ tab: "properties" }}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <Download className="h-4 w-4" />
          Open listings media tools
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users in app"
          value={analytics.totals.totalUsers}
          hint={`${analytics.totals.totalTenantAccounts} tenants · ${analytics.totals.totalListingAccounts} listing accounts`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Active now"
          value={analytics.totals.activeUsersNow}
          hint={
            analytics.presenceRealtime
              ? `${analytics.presenceRealtime.totalConnections} live sockets · ${analytics.presenceRealtime.anonymousSessions} anonymous`
              : `${analytics.totals.activeSessionsNow} active sessions · ${analytics.totals.activeTenantsNow} tenants`
          }
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Portal accounts"
          value={analytics.totals.activePortalAccounts}
          hint={`${analytics.totals.inactivePortalAccounts} inactive`}
          icon={<Search className="h-4 w-4" />}
        />
        <StatCard
          label="Lead actions"
          value={analytics.totals.totalLeads}
          hint={`${analytics.totals.totalInquiries} inquiries · ${analytics.totals.totalViewings} viewings`}
          icon={<PhoneCall className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Engagement over last 7 days</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Views, leads, inquiries, and bookings created each day.
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.activityChart7d}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="propertyViews" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="leads" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="inquiries" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="viewings" stroke="#64748b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Most searched areas</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on property detail traffic by neighborhood in the last 30 days.
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topAreas} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="neighborhood" width={92} />
                <Tooltip />
                <Bar dataKey="recentViews30d" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Property traffic and leads</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Shows the listings getting the most attention and lead activity.
              </p>
            </div>
            <Link to="/admin" search={{ tab: "properties" }} className="text-xs font-semibold text-primary">
              Go to listings
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-3">Property</th>
                  <th className="pb-3">Traffic</th>
                  <th className="pb-3">Leads</th>
                  <th className="pb-3">Contact</th>
                  <th className="pb-3">Media</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topProperties.map((property) => (
                  <tr key={property.propertyId}>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium">{property.title}</div>
                      <div className="text-xs text-muted-foreground">{property.neighborhood}</div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{property.recentViews30d} / 30d</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {property.uniqueViewers30d} viewers · {property.lifetimeViews} lifetime
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div>{property.leads30d} leads</div>
                      <div className="text-xs text-muted-foreground">
                        {property.inquiries30d} inquiries · {property.viewings30d} bookings
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div>{property.contactName || "No contact name"}</div>
                      <div className="text-xs text-muted-foreground">
                        {property.contactPhones.join(", ") || "No phone on listing"}
                      </div>
                    </td>
                    <td className="py-3 align-top">
                      <div>{property.mediaCount} file(s)</div>
                      <div className="text-xs text-muted-foreground">
                        {property.hasDownloadableMedia ? "Downloadable from Moderate listings" : "No uploads"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Lead source mix</h3>
          <p className="mt-1 text-xs text-muted-foreground">How tenants are entering the funnel in the last 30 days.</p>
          <div className="mt-4 space-y-3">
            {analytics.leadSources30d.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lead activity yet.</p>
            ) : (
              analytics.leadSources30d.map((source) => (
                <div key={source.source} className="rounded-xl border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium capitalize">{source.source}</span>
                    <span className="text-sm text-muted-foreground">{source.count}</span>
                  </div>
                </div>
              ))
            )}
            <div className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
              Media download is already enabled from the `Moderate listings` tab for listings with uploaded photos or videos.
            </div>
          </div>
        </div>
      </div>

      {analytics.presenceRealtime && analytics.presenceRealtime.totalConnections > 0 ? (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Live sessions</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Real-time WebSocket connections · refreshed every 15s
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {analytics.presenceRealtime.totalConnections} connected · {analytics.presenceRealtime.uniqueUsers} signed-in
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Page</th>
                  <th className="pb-3">Roles</th>
                  <th className="pb-3">Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.presenceRealtime.sessions.slice(0, 50).map((session) => (
                  <tr key={session.sessionId}>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium">{session.userId ?? "Anonymous"}</div>
                      <div className="text-xs text-muted-foreground">{session.sessionId.slice(0, 8)}…</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-muted-foreground">{session.path || "/"}</td>
                    <td className="py-3 pr-4 align-top">
                      {session.roles.length > 0 ? session.roles.join(", ") : "—"}
                    </td>
                    <td className="py-3 align-top text-muted-foreground">
                      {session.connectedAt
                        ? formatDistanceToNow(new Date(session.connectedAt), { addSuffix: true })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Tenant account activity</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Full tenant list with live status, last activity, and recent actions.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Listings with media: {analytics.totals.mediaReadyListings} · Active listings: {analytics.totals.activeListings}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-3">Tenant</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Last activity</th>
                <th className="pb-3">30d activity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topTenants.map((tenant) => (
                <tr key={tenant.userId}>
                  <td className="py-3 pr-4 align-top">
                    <div className="font-medium">{tenant.fullName || "Unnamed tenant"}</div>
                    <div className="text-xs text-muted-foreground">
                      {tenant.phone || "No phone"} · {tenant.tenantPlan}
                      {tenant.plusExpiresAt ? ` · Plus until ${new Date(tenant.plusExpiresAt).toLocaleDateString()}` : ""}
                    </div>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <TenantStatusBadge status={tenant.status} />
                  </td>
                  <td className="py-3 pr-4 align-top text-muted-foreground">
                    {formatLastActivity(tenant.lastActivityAt)}
                  </td>
                  <td className="py-3 align-top">
                    <div>
                      {tenant.metrics.propertyViews30d} views · {tenant.metrics.saves30d} saves
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tenant.metrics.contactUnlocks30d} unlocks · {tenant.metrics.inquiries30d} inquiries ·{" "}
                      {tenant.metrics.viewings30d} bookings
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
