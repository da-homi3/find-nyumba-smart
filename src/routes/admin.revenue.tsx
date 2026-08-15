import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatKes } from "@/lib/properties";
import { TENANT_PLUS_CONFIG } from "@/lib/revenue/tenant-plus-config";
import { getAdminRevenueStats } from "@/lib/api/revenue.functions";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export const Route = createFileRoute("/admin/revenue")({
  component: AdminRevenuePage,
});

function AdminRevenuePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-revenue-stats"],
    queryFn: () => getAdminRevenueStats(),
  });

  const chart = data?.chart ?? [];
  const latest = data?.latest ?? {
    month: "—",
    mrr: 0,
    verification: 0,
    leads: 0,
    plus: 0,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link to="/admin" search={{ tab: undefined }} className="text-sm text-primary">
        ← Admin
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">Revenue dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Live data from completed payments</p>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Tenant Plus commercial config</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Live values from platform settings (admin Tenant Plus tab). Checkout charges these amounts.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Monthly</dt>
            <dd className="font-medium">{formatKes(TENANT_PLUS_CONFIG.monthlyKes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">3 months</dt>
            <dd className="font-medium">{formatKes(TENANT_PLUS_CONFIG.quarterlyKes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Credits / month</dt>
            <dd className="font-medium">{TENANT_PLUS_CONFIG.contactCreditsPerMonth}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Free save cap</dt>
            <dd className="font-medium">{TENANT_PLUS_CONFIG.freeSavedPropertyLimit}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Free compare</dt>
            <dd className="font-medium">{TENANT_PLUS_CONFIG.freeCompareLimit}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">AI / finance flags</dt>
            <dd className="font-medium">
              {TENANT_PLUS_CONFIG.flags.aiEnabled ? "AI on" : "AI off"} ·{" "}
              {TENANT_PLUS_CONFIG.flags.financialServicesEnabled ? "Finance on" : "Finance off"}
            </dd>
          </div>
        </dl>
      </section>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading revenue…</p>
      ) : null}
      {isError ? (
        <p className="mt-8 text-sm text-destructive">Could not load revenue stats.</p>
      ) : null}
      {!isLoading && !isError ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["MRR (this month)", latest.mrr],
              ["Verification", latest.verification],
              ["Lead packs", latest.leads],
              ["Plus members", data?.plusMembers ?? 0],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-2xl border bg-card p-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {(label as string).includes("members") ? String(val) : formatKes(val as number)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 h-72 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">MRR (last 6 months)</h2>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chart}>
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatKes(v)} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 h-72 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Revenue by stream</h2>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={chart}>
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatKes(v)} />
                <Legend />
                <Bar dataKey="boosts" stackId="a" fill="#c9a227" />
                <Bar dataKey="verification" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="leads" stackId="a" fill="#64748b" />
                <Bar dataKey="plus" stackId="a" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}
