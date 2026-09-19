import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { useActivePilotId } from "@/hooks/use-partner-pilot";
import { getPilotReport } from "@/lib/api/pilot-partnership.functions";

export const Route = createFileRoute("/partner/report")({
  head: () => ({ meta: [{ title: "Pilot report — NyumbaSearch" }] }),
  component: () => (
    <PartnerShell>
      <PartnerReportPage />
    </PartnerShell>
  ),
});

function PartnerReportPage() {
  const { pilotId } = useActivePilotId();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pilot-report", pilotId],
    enabled: !!pilotId,
    queryFn: () => getPilotReport({ data: { pilotId: pilotId! } }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <p className="text-sm text-muted-foreground">
          {(error as Error | undefined)?.message ?? "Report unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Pilot report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Print-ready summary for {data.partnerName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => globalThis.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-card p-6 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b pb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            NyumbaSearch Pilot Partnership
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">{data.partnerName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.period.start ?? "—"} → {data.period.end ?? "—"} · Status{" "}
            {String(data.status).replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </header>

        <section>
          <h3 className="font-display text-lg font-semibold">Totals</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Views", data.totals.views],
                ["Enquiries", data.totals.enquiries],
                ["Calls", data.totals.calls],
                ["WhatsApp", data.totals.whatsapp],
                ["Viewings", data.totals.viewings],
                ["Saves", data.totals.saves],
                ["Impressions", data.totals.impressions],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border bg-background px-3 py-2 print:border-border"
              >
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="font-display text-lg font-semibold">Funnel</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {data.funnel.map((row) => (
              <li
                key={row.stage}
                className="flex justify-between gap-4 border-b border-dashed py-1.5"
              >
                <span>{row.stage.replaceAll("_", " ")}</span>
                <span className="tabular-nums font-medium">{row.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-lg font-semibold">KPIs</h3>
          {data.kpis.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No KPIs configured.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {data.kpis.map((kpi) => (
                <li
                  key={kpi.id}
                  className="flex justify-between gap-4 border-b border-dashed py-1.5"
                >
                  <span>{kpi.metric}</span>
                  <span className="tabular-nums">
                    {Number(kpi.actual).toLocaleString()} / {Number(kpi.target).toLocaleString()}{" "}
                    {kpi.unit} ({kpi.progress?.percentage ?? 0}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="font-display text-lg font-semibold">Top properties</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {data.topProperties.map((p) => (
              <li key={p.id} className="flex justify-between gap-4 border-b border-dashed py-1.5">
                <span>{p.title}</span>
                <span className="text-muted-foreground">{p.status.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-lg font-semibold">Lead breakdown</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {data.leadBreakdown.length === 0 ? (
              <li className="text-muted-foreground">No leads in period.</li>
            ) : (
              data.leadBreakdown.map((row) => (
                <li
                  key={row.type}
                  className="flex justify-between gap-4 border-b border-dashed py-1.5"
                >
                  <span className="capitalize">{row.type}</span>
                  <span className="tabular-nums font-medium">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 print:bg-transparent">
          <h3 className="font-display text-lg font-semibold">Recommendation</h3>
          <p className="mt-1 text-sm font-semibold text-primary">{data.recommendation}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.philosophy}</p>
        </section>
      </article>
    </div>
  );
}
