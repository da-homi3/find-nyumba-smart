import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listManagerProperties, listLandlordLeads } from "@/lib/api/nyumba.functions";
import { Building2, Download, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/manager/dashboard")({
  head: () => ({ meta: [{ title: "Property manager — NyumbaSearch" }] }),
  component: ManagerDashboard,
});

const PIPELINE = [
  "Just Vacated",
  "Listed",
  "Inquiries Received",
  "Viewing Booked",
  "Filled",
] as const;

function ManagerDashboard() {
  const { data: properties = [] } = useQuery({
    queryKey: ["manager-properties"],
    queryFn: () => listManagerProperties(),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["manager-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const vacant = properties.filter((p) => (p as { is_vacant?: boolean }).is_vacant !== false).length;
  const occupied = properties.length - vacant;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-foreground px-5 py-4 text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-background/60">Property manager</p>
            <h1 className="font-display text-lg font-semibold">Portfolio overview</h1>
          </div>
          <Link to="/settings" className="text-sm text-gold">
            Settings →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Properties managed" value={String(properties.length)} />
          <StatCard label="Vacant units" value={String(vacant)} />
          <StatCard
            label="Occupancy rate"
            value={`${properties.length ? Math.round((occupied / properties.length) * 100) : 0}%`}
          />
        </div>

        <section>
          <h2 className="font-display text-lg font-semibold">Your portfolio</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {properties.slice(0, 9).map((p) => (
              <div key={p.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">{p.title}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.neighborhood}</p>
                <p className="mt-2 text-sm font-semibold">{formatKes(p.rent_kes)}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Vacancy pipeline</h2>
            <button
              type="button"
              onClick={() => toast.success("Vacancy report exported (CSV mock)")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {PIPELINE.map((col, ci) => (
              <div key={col} className="rounded-2xl border bg-card p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{col}</p>
                <div className="mt-2 space-y-2">
                  {properties
                    .filter((_, i) => i % PIPELINE.length === ci)
                    .slice(0, 3)
                    .map((p) => (
                      <div key={p.id} className="rounded-lg bg-secondary px-2 py-1.5 text-xs font-medium">
                        {p.title}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Inbox className="h-5 w-5" /> Leads ({leads.length})
          </h2>
          <Link
            to="/landlord/leads"
            search={{ thread: undefined }}
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Open unified inbox →
          </Link>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
