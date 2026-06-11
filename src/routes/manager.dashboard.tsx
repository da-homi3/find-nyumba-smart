import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties } from "@/lib/properties";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Download, Inbox } from "lucide-react";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => fetchProperties(),
  });

  const total = properties.length;
  const occupied = Math.floor(total * 0.72);
  const vacant = total - occupied;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-foreground px-5 py-4 text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-background/60">
              Property manager
            </p>
            <h1 className="font-display text-lg font-semibold">Portfolio overview</h1>
          </div>
          <Link to="/landlord/leads" search={{ thread: undefined }} className="text-sm text-gold">
            Unified inbox →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Properties managed" value={String(total)} />
          <StatCard label="Total units" value={String(total)} />
          <StatCard
            label="Occupancy rate"
            value={`${total ? Math.round((occupied / total) * 100) : 0}%`}
          />
        </div>

        <section>
          <h2 className="font-display text-lg font-semibold">Occupancy by property</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {properties.slice(0, 6).map((p, i) => (
              <div key={p.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">{p.title}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Vacant: {i % 3 === 0 ? 1 : 0} · Occupied: {i % 3 === 0 ? 2 : 3}
                </p>
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
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {PIPELINE.map((col, ci) => (
              <div key={col} className="min-w-[160px] shrink-0 rounded-xl border bg-card p-3">
                <p className="text-xs font-semibold text-muted-foreground">{col}</p>
                <div className="mt-2 space-y-2">
                  {properties
                    .filter((_, i) => i % PIPELINE.length === ci)
                    .slice(0, 2)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="rounded-lg bg-secondary p-2 text-[11px] font-medium"
                      >
                        {p.neighborhood} · {p.title.slice(0, 20)}…
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Inbox className="h-5 w-5 text-primary" />
            Tenant inquiries
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {user
              ? "Open the unified inbox to reply across all managed properties."
              : "Sign in as a property manager to view inquiries."}
          </p>
          <Link
            to="/landlord/leads"
            search={{ thread: undefined }}
            className="mt-4 inline-block text-sm font-semibold text-primary"
          >
            Go to inbox →
          </Link>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
