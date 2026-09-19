import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  Eye,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { useActivePilotId, usePilotDetail } from "@/hooks/use-partner-pilot";

export const Route = createFileRoute("/partner/")({
  head: () => ({ meta: [{ title: "Pilot dashboard — NyumbaSearch" }] }),
  component: () => (
    <PartnerShell>
      <PartnerDashboard />
    </PartnerShell>
  ),
});

function PartnerDashboard() {
  const { pilotId, data: pilots, isLoading: pilotsLoading } = useActivePilotId();
  const { data, isLoading } = usePilotDetail(pilotId);
  const pilot = data?.pilot ?? pilots?.[0];
  const totals = data?.totals;
  const liveCount = data?.properties?.filter((p) => p.status === "LIVE").length ?? 0;

  if (pilotsLoading || isLoading) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["a", "b", "c", "d"].map((id) => (
            <div key={id} className="h-28 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const days = pilot && "daysRemaining" in pilot ? pilot.daysRemaining : null;
  const onboarding = (pilot && "onboarding" in pilot ? pilot.onboarding : null) as
    | { completedAt?: string }
    | null;
  const profileIncomplete = !onboarding?.completedAt;

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pilot Partnership
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {pilot?.partner_name ?? "Partner dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track how your pilot listings perform on NyumbaSearch.
          </p>
        </div>
        <Link
          to="/partner/analytics"
          className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40"
        >
          <BarChart3 className="h-4 w-4 text-primary" />
          View performance
        </Link>
      </header>

      {profileIncomplete ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm text-foreground">
            Optional: add your company name and contact so tenants recognise you. Takes about 2
            minutes.
          </p>
          <Link
            to="/partner/onboarding"
            className="shrink-0 rounded-xl bg-foreground px-3 py-1.5 text-sm font-semibold text-background"
          >
            Add details
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Status"
          value={formatStatus(pilot?.status)}
          hint={pilot?.partner_type?.replaceAll("_", " ") ?? ""}
        />
        <StatCard
          icon={CalendarDays}
          label="Days remaining"
          value={days == null ? "—" : String(days)}
          hint={pilot?.pilot_end_date ? `Ends ${pilot.pilot_end_date}` : "Pilot window"}
        />
        <StatCard
          icon={Building2}
          label="Properties live"
          value={String(liveCount)}
          hint={`${data?.properties?.length ?? 0} in pilot`}
        />
        <StatCard
          icon={Eye}
          label="Views"
          value={(totals?.views ?? 0).toLocaleString()}
          hint="Pilot period"
        />
        <StatCard
          icon={MessageCircle}
          label="Enquiries"
          value={String(totals?.enquiries ?? 0)}
          hint="Attributed leads"
        />
        <StatCard
          icon={Phone}
          label="Calls"
          value={String(totals?.calls ?? 0)}
          hint="Call clicks"
        />
        <StatCard
          icon={MessageCircle}
          label="WhatsApp"
          value={String(totals?.whatsapp ?? 0)}
          hint="WhatsApp clicks"
        />
        <StatCard
          icon={Users}
          label="Viewings"
          value={String(totals?.viewings ?? 0)}
          hint="Viewing requests"
        />
      </div>

      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">How this pilot works</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          We prove the value first, measure the results, and build the long-term partnership around
          what works. Your dashboard shows only activity attributed to listings in this pilot — no
          invented benchmarks.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/partner/report"
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Open pilot report
          </Link>
          <Link
            to="/partner/onboarding"
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Edit profile
          </Link>
        </div>
      </section>
    </div>
  );
}

function formatStatus(status: string | undefined) {
  if (!status) return "—";
  return status.replaceAll("_", " ");
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: Readonly<{
  icon: typeof Eye;
  label: string;
  value: string;
  hint: string;
}>) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
