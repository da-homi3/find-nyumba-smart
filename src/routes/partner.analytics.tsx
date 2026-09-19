import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { useActivePilotId, usePilotDetail } from "@/hooks/use-partner-pilot";

export const Route = createFileRoute("/partner/analytics")({
  head: () => ({ meta: [{ title: "Pilot analytics — NyumbaSearch" }] }),
  component: () => (
    <PartnerShell>
      <PartnerAnalyticsPage />
    </PartnerShell>
  ),
});

function PartnerAnalyticsPage() {
  const { pilotId } = useActivePilotId();
  const { data, isLoading } = usePilotDetail(pilotId);
  const funnel = data?.funnel ?? [];
  const kpis = data?.kpis ?? [];
  const totals = data?.totals;
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  const metricRows = [
    { label: "Impressions", value: totals?.impressions ?? 0 },
    { label: "Views", value: totals?.views ?? 0 },
    { label: "Saves", value: totals?.saves ?? 0 },
    { label: "Enquiries", value: totals?.enquiries ?? 0 },
    { label: "Calls", value: totals?.calls ?? 0 },
    { label: "WhatsApp", value: totals?.whatsapp ?? 0 },
    { label: "Viewings", value: totals?.viewings ?? 0 },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <header>
        <h1 className="font-display text-3xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Funnel and KPI progress for this pilot period. Figures reflect attributed activity only.
        </p>
      </header>

      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Conversion funnel</h2>
        <ul className="mt-5 space-y-3">
          {funnel.map((stage) => (
            <li key={stage.stage}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{stage.stage.replaceAll("_", " ")}</span>
                <span className="tabular-nums text-muted-foreground">
                  {stage.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80 transition-all"
                  style={{ width: `${Math.max(2, (stage.value / maxFunnel) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">KPI progress</h2>
        {kpis.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No success criteria defined yet. Add them in onboarding.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {kpis.map((kpi) => {
              const pct = Math.min(100, kpi.progress?.percentage ?? 0);
              return (
                <li key={kpi.id}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{kpi.metric}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Number(kpi.actual).toLocaleString()} / {Number(kpi.target).toLocaleString()}{" "}
                      {kpi.unit}
                      <span className="ml-2 text-xs uppercase tracking-wide text-primary">
                        {kpi.progress?.status?.replaceAll("_", " ")}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Metrics</h2>
        <ul className="mt-4 divide-y">
          {metricRows.map((row) => (
            <li key={row.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold tabular-nums">{row.value.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
