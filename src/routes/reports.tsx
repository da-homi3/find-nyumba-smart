import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatKes } from "@/lib/properties";

const RENT_BY_HOOD = [
  { hood: "Kilimani", rent: 45000 },
  { hood: "Westlands", rent: 52000 },
  { hood: "Karen", rent: 85000 },
  { hood: "Kasarani", rent: 22000 },
  { hood: "South B", rent: 38000 },
];

const TREND = [
  { year: "2024", index: 100 },
  { year: "2025", index: 108 },
  { year: "2026", index: 115 },
];

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Market reports — NyumbaSearch" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">
          Data-driven decisions for Nairobi&apos;s property market
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free teaser charts below. Full neighborhood breakdowns available with Plus or paid
          reports.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Average 2BR rent by neighborhood — Q2 2026</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={RENT_BY_HOOD}>
                  <XAxis dataKey="hood" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatKes(v)} />
                  <Bar dataKey="rent" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Nairobi rental price trends 2024–2026</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={TREND}>
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="index"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Rental demand remains strongest in Kilimani and Westlands, with supply tightening in Karen
          for family units under {formatKes(90000)}/month.
        </p>

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
