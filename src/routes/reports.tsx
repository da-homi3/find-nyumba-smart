import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { PublicPageShell } from "@/components/SiteNav";
import { BrandBarChart, BrandLineChart } from "@/components/dashboard/AnalyticsChart";
import { formatKes } from "@/lib/properties";
import { getMarketReportTeaser } from "@/lib/api/stats.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Market reports — NyumbaSearch" }] }),
  component: ReportsPage,
});

function ClientChart({ children }: Readonly<{ children: ReactNode }>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-56 animate-pulse rounded-xl bg-muted/60" aria-hidden />;
  }
  return children;
}

function ReportsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["market-report-teaser"],
    queryFn: () => getMarketReportTeaser(),
    staleTime: 300_000,
  });

  const rentByHood = data?.rentByHood ?? [];
  const trend = data?.trend ?? [];

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">
          Data-driven decisions for Nairobi&apos;s property market
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live averages from active NyumbaSearch listings. Full neighborhood breakdowns available
          with Plus or paid reports.
        </p>

        {isLoading ? (
          <div className="mt-10 flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <div className="rounded-2xl border bg-card p-4">
                <h2 className="text-sm font-semibold">
                  Average rent by neighborhood — live listings
                </h2>
                <div className="mt-4 h-56 min-h-56">
                  <ClientChart>
                    <BrandBarChart
                      data={rentByHood}
                      xKey="hood"
                      yKey="rent"
                      tooltipFormatter={(v) => formatKes(v)}
                    />
                  </ClientChart>
                </div>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Nairobi rental price index</h2>
                <div className="mt-4 h-56 min-h-56">
                  <ClientChart>
                    <BrandLineChart data={trend} xKey="year" yKey="index" />
                  </ClientChart>
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              {isError
                ? "Could not load live market data — showing cached estimates."
                : (data?.summary ??
                  "Browse verified listings on NyumbaSearch for the most up-to-date Nairobi rents.")}
            </p>
          </>
        )}

        <section className="mt-12 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left">
                <th className="p-4">Report</th>
                <th className="p-4">Price</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {[
                ["Nairobi Rental Market Overview (quarterly)", 5000],
                ["Neighborhood Deep Dive (per area)", 8000],
                ["Annual Housing Market Report", 25000],
              ].map(([name, price]) => (
                <tr key={name as string} className="border-b">
                  <td className="p-4">{name}</td>
                  <td className="p-4 font-semibold">{formatKes(price as number)}</td>
                  <td className="p-4">
                    <Link
                      to="/landlord/checkout"
                      search={{ product: "report" } as never}
                      className="text-primary font-semibold"
                    >
                      Buy report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </PublicPageShell>
  );
}
