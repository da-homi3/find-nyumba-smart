import { useEffect, useState, type SubmitEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  addPilotActivityNote,
  getPilotPartnership,
  getPilotReport,
  resendPilotInvitation,
  reviewPilotProperty,
  updatePilotLifecycle,
  updatePilotPublicSettings,
} from "@/lib/api/pilot-partnership.functions";
import { COMMERCIAL_MODELS, type CommercialModel } from "@/lib/pilot/types";
import { AdminField, StatusBadge } from "@/components/admin/admin-shared";
import { BrandLogo } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { buildPageHead } from "@/lib/seo/head";
import { useAuth } from "@/hooks/use-auth";
import { getSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/admin/partnerships/$pilotId")({
  head: () =>
    buildPageHead({
      title: "Pilot partnership — Admin",
      description: "NyumbaSearch pilot partnership detail.",
      path: "/admin/partnerships",
      noIndex: true,
    }),
  component: () => (
    <RouteErrorBoundary title="Pilot partnership page failed to load">
      <AdminPilotDetailPage />
    </RouteErrorBoundary>
  ),
});

const PILOT_STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700",
  EXTENDED: "bg-emerald-500/10 text-emerald-700",
  CONVERTED: "bg-emerald-500/15 text-emerald-800",
  COMPLETED: "bg-secondary text-muted-foreground",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700",
  INVITED: "bg-sky-500/10 text-sky-700",
  ONBOARDING: "bg-sky-500/10 text-sky-700",
  PAUSED: "bg-secondary text-muted-foreground",
  DECLINED: "bg-red-500/10 text-red-600",
  CANCELLED: "bg-red-500/10 text-red-600",
};

function AdminPilotDetailPage() {
  const { pilotId } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [noteBody, setNoteBody] = useState("");
  const [extendDays, setExtendDays] = useState(30);
  const [commercialModel, setCommercialModel] =
    useState<CommercialModel>("PORTFOLIO_PARTNERSHIP");
  const [showBadge, setShowBadge] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-pilot-detail", pilotId],
    queryFn: () => getPilotPartnership({ data: { pilotId } }),
    enabled: isAdmin && !authLoading,
  });

  useEffect(() => {
    if (!data?.pilot) return;
    setShowBadge(Boolean(data.pilot.show_partner_badge));
    setPublicSlug(data.pilot.public_slug ?? "");
  }, [data?.pilot]);

  const { data: report, isFetching: reportLoading } = useQuery({
    queryKey: ["admin-pilot-report", pilotId],
    queryFn: () => getPilotReport({ data: { pilotId } }),
    enabled: isAdmin && !authLoading && Boolean(data),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-pilot-detail", pilotId] });
    void qc.invalidateQueries({ queryKey: ["admin-pilot-report", pilotId] });
    void qc.invalidateQueries({ queryKey: ["admin-pilot-partnerships"] });
  };

  const lifecycle = useMutation({
    mutationFn: (payload: {
      action:
        | "approve"
        | "reject"
        | "start_onboarding"
        | "activate"
        | "pause"
        | "extend"
        | "complete"
        | "convert"
        | "cancel";
      extendDays?: number;
      commercialModel?: CommercialModel;
      reason?: string;
    }) => updatePilotLifecycle({ data: { pilotId, ...payload } }),
    onSuccess: () => {
      toast.success("Lifecycle updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendInvite = useMutation({
    mutationFn: () => resendPilotInvitation({ data: { pilotId } }),
    onSuccess: (res) => {
      setLastInviteUrl(res.inviteUrl);
      void navigator.clipboard?.writeText(res.inviteUrl).catch(() => undefined);
      toast.success(
        res.emailSent ? "Invite resent by email" : "Invite link ready (email may have failed)",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePublicSettings = useMutation({
    mutationFn: () =>
      updatePilotPublicSettings({
        data: {
          pilotId,
          showPartnerBadge: showBadge,
          publicSlug: publicSlug.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Public partner settings saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewProperty = useMutation({
    mutationFn: (payload: {
      pilotPropertyId: string;
      action: "approve" | "reject" | "live";
      reason?: string;
    }) => reviewPilotProperty({ data: payload }),
    onSuccess: () => {
      toast.success("Property review updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: () => addPilotActivityNote({ data: { pilotId, body: noteBody.trim() } }),
    onSuccess: () => {
      toast.success("Note added");
      setNoteBody("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-destructive">
          {(error as Error | undefined)?.message ?? "Pilot not found."}
        </p>
        <Link
          to="/admin"
          search={{ tab: "partnerships" }}
          className="mt-4 inline-block text-sm font-semibold text-primary"
        >
          Back to partnerships
        </Link>
      </div>
    );
  }

  const { pilot, properties, leads, kpis, notes, totals, funnel } = data;

  function onNoteSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    addNote.mutate();
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card px-4 py-4 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/admin"
              search={{ tab: "partnerships" }}
              aria-label="Back to partnerships"
              className="shrink-0 rounded-full p-1.5 hover:bg-secondary"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div className="shrink-0 rounded-lg bg-white px-2 py-1 shadow-sm">
              <BrandLogo logoClassName="h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold sm:text-xl">
                {pilot.partner_name}
              </h1>
              <p className="text-xs text-muted-foreground">Pilot partnership</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={reportLoading || !report}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print report
            </button>
            <DashboardSettingsLink variant="pill" />
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-6xl space-y-8 px-4 sm:px-6">
        <AdminPilotOverviewSection
          partnerType={pilot.partner_type}
          status={pilot.status}
          primaryContactEmail={pilot.primary_contact_email}
          primaryContactPhone={pilot.primary_contact_phone}
          pilotStartDate={pilot.pilot_start_date}
          pilotEndDate={pilot.pilot_end_date}
          daysRemaining={pilot.daysRemaining}
          proposedPropertyCount={pilot.proposed_property_count}
          extendDays={extendDays}
          onExtendDaysChange={setExtendDays}
          commercialModel={commercialModel}
          onCommercialModelChange={setCommercialModel}
          lifecyclePending={lifecycle.isPending}
          onLifecycle={(payload) => lifecycle.mutate(payload)}
          resendPending={resendInvite.isPending}
          onResend={() => resendInvite.mutate()}
          lastInviteUrl={lastInviteUrl}
        />

        <section className="rounded-2xl border bg-card p-5 print:hidden">
          <h2 className="font-display text-lg font-semibold">Public profile &amp; badge</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Control the Official Partner badge on listing cards and the public profile URL.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showBadge}
                onChange={(e) => setShowBadge(e.target.checked)}
              />
              <span>Show Official Partner badge</span>
            </label>
            <AdminField label="Public slug">
              <input
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value.toLowerCase())}
                placeholder="anga-homes"
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </AdminField>
          </div>
          {publicSlug ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Profile: {getSiteUrl()}/partners/{publicSlug}
            </p>
          ) : null}
          <button
            type="button"
            disabled={savePublicSettings.isPending}
            onClick={() => savePublicSettings.mutate()}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {savePublicSettings.isPending ? "Saving…" : "Save public settings"}
          </button>
        </section>

        <AdminPilotPropertiesSection
          properties={properties}
          pending={reviewProperty.isPending}
          onReview={(payload) => reviewProperty.mutate(payload)}
        />

        <AdminPilotLeadsSection leads={leads} />

        {/* Analytics / funnel */}
        <section className="rounded-2xl border bg-card p-5 print:hidden">
          <h2 className="font-display text-lg font-semibold">Analytics / funnel</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Views", totals.views],
                ["Saves", totals.saves],
                ["Enquiries", totals.enquiries],
                ["Viewings", totals.viewings],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <ol className="mt-4 space-y-2">
            {funnel.map((stage) => (
              <li
                key={stage.stage}
                className="flex items-center justify-between rounded-xl border px-4 py-2 text-sm"
              >
                <span className="font-medium">{stage.stage.replaceAll("_", " ")}</span>
                <span className="tabular-nums text-muted-foreground">{stage.value}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* KPIs */}
        <section className="rounded-2xl border bg-card p-5 print:hidden">
          <h2 className="font-display text-lg font-semibold">KPIs</h2>
          {kpis.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No KPI targets set.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {kpis.map((kpi) => (
                <li key={kpi.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{kpi.metric}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(kpi.actual)} / {Number(kpi.target)} {kpi.unit}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, kpi.progress?.percentage ?? 0)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                    {kpi.progress?.status?.replaceAll("_", " ") ?? "—"} ·{" "}
                    {kpi.progress?.percentage ?? 0}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-2xl border bg-card p-5 print:hidden">
          <h2 className="font-display text-lg font-semibold">Notes</h2>
          <form onSubmit={onNoteSubmit} className="mt-3 space-y-2">
            <AdminField label="Add activity note">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Call notes, follow-ups, decisions…"
              />
            </AdminField>
            <button
              type="submit"
              disabled={addNote.isPending || !noteBody.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {addNote.isPending ? "Saving…" : "Add note"}
            </button>
          </form>
          <ul className="mt-4 space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border bg-secondary/30 p-3 text-sm">
                <p>{note.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {note.author_role} · {new Date(note.created_at).toLocaleString()}
                </p>
              </li>
            ))}
            {notes.length === 0 ? (
              <li className="text-sm text-muted-foreground">No notes yet.</li>
            ) : null}
          </ul>
        </section>

        {/* Print-ready report */}
        <section id="pilot-report-print" className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <h2 className="font-display text-lg font-semibold">Pilot report</h2>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!report}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Download / print
            </button>
          </div>
          {!report ? (
            <p className="mt-2 text-sm text-muted-foreground print:hidden">
              {reportLoading ? "Loading report…" : "Report unavailable."}
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <h3 className="font-display text-xl font-semibold">{report.partnerName}</h3>
                <p className="text-muted-foreground">
                  {report.period.start} → {report.period.end} · {report.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.entries(report.totals).map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-3">
                    <p className="text-xs capitalize text-muted-foreground">
                      {key.replaceAll("_", " ")}
                    </p>
                    <p className="font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-semibold">Recommendation</h4>
                <p className="mt-1">{report.recommendation}</p>
                <p className="mt-2 text-xs italic text-muted-foreground">{report.philosophy}</p>
              </div>
              {report.topProperties.length > 0 ? (
                <div>
                  <h4 className="font-semibold">Top properties</h4>
                  <ul className="mt-1 list-inside list-disc">
                    {report.topProperties.map((p) => (
                      <li key={p.id}>
                        {p.title} ({p.status})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type ReviewAction = {
  pilotPropertyId: string;
  action: "approve" | "reject" | "live";
  reason?: string;
};

type LifecyclePayload = {
  action:
    | "approve"
    | "reject"
    | "start_onboarding"
    | "activate"
    | "pause"
    | "extend"
    | "complete"
    | "convert"
    | "cancel";
  extendDays?: number;
  commercialModel?: CommercialModel;
  reason?: string;
};

function AdminPilotOverviewSection({
  partnerType,
  status,
  primaryContactEmail,
  primaryContactPhone,
  pilotStartDate,
  pilotEndDate,
  daysRemaining,
  proposedPropertyCount,
  extendDays,
  onExtendDaysChange,
  commercialModel,
  onCommercialModelChange,
  lifecyclePending,
  onLifecycle,
  resendPending,
  onResend,
  lastInviteUrl,
}: Readonly<{
  partnerType: string;
  status: string;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  pilotStartDate: string | null;
  pilotEndDate: string | null;
  daysRemaining: number | null;
  proposedPropertyCount: number | null;
  extendDays: number;
  onExtendDaysChange: (days: number) => void;
  commercialModel: CommercialModel;
  onCommercialModelChange: (model: CommercialModel) => void;
  lifecyclePending: boolean;
  onLifecycle: (payload: LifecyclePayload) => void;
  resendPending: boolean;
  onResend: () => void;
  lastInviteUrl: string | null;
}>) {
  const daysLabel = daysRemaining == null ? "—" : `${daysRemaining}d`;
  return (
    <section className="rounded-2xl border bg-card p-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Overview</h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {partnerType.replaceAll("_", " ").toLowerCase()}
          </p>
        </div>
        <StatusBadge
          status={status}
          classMap={PILOT_STATUS_CLASS}
          fallbackClass="bg-secondary text-muted-foreground"
        />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Contact</dt>
          <dd className="font-medium">{primaryContactEmail}</dd>
          {primaryContactPhone ? (
            <dd className="text-xs text-muted-foreground">{primaryContactPhone}</dd>
          ) : null}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Period</dt>
          <dd className="font-medium">
            {pilotStartDate ?? "—"} → {pilotEndDate ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Days remaining</dt>
          <dd className="font-medium tabular-nums">{daysLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Proposed listings</dt>
          <dd className="font-medium">{proposedPropertyCount ?? "—"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["approve", "Approve"],
            ["start_onboarding", "Start onboarding"],
            ["activate", "Activate"],
            ["pause", "Pause"],
            ["complete", "Complete"],
            ["cancel", "Cancel"],
          ] as const
        ).map(([action, label]) => (
          <button
            key={action}
            type="button"
            disabled={lifecyclePending}
            onClick={() => onLifecycle({ action })}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={180}
            value={extendDays}
            onChange={(e) => onExtendDaysChange(Number(e.target.value))}
            className="w-20 rounded-lg border px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={lifecyclePending}
            onClick={() => onLifecycle({ action: "extend", extendDays })}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Extend
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={commercialModel}
            onChange={(e) => onCommercialModelChange(e.target.value as CommercialModel)}
            className="rounded-lg border px-2 py-1.5 text-xs"
          >
            {COMMERCIAL_MODELS.map((m) => (
              <option key={m} value={m}>
                {m.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={lifecyclePending}
            onClick={() => onLifecycle({ action: "convert", commercialModel })}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Convert
          </button>
        </div>
        <button
          type="button"
          disabled={resendPending}
          onClick={onResend}
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
        >
          {resendPending ? "Sending…" : "Resend invite"}
        </button>
      </div>
      {lastInviteUrl ? (
        <p className="mt-3 break-all text-xs text-muted-foreground">
          Latest invite: {lastInviteUrl}
        </p>
      ) : null}
    </section>
  );
}

function AdminPilotPropertiesSection({
  properties,
  pending,
  onReview,
}: Readonly<{
  properties: Array<{
    id: string;
    property_id: string;
    status: string;
    properties: unknown;
  }>;
  pending: boolean;
  onReview: (payload: ReviewAction) => void;
}>) {
  return (
    <section className="rounded-2xl border bg-card p-5 print:hidden">
      <h2 className="font-display text-lg font-semibold">Properties</h2>
      {properties.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No pilot properties yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((row) => {
                const prop = row.properties as {
                  title?: string;
                  neighborhood?: string;
                } | null;
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{prop?.title ?? "Property"}</p>
                      <p className="text-xs text-muted-foreground">
                        {prop?.neighborhood ?? row.property_id}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onReview({ pilotPropertyId: row.id, action: "approve" })}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onReview({ pilotPropertyId: row.id, action: "live" })}
                          className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                        >
                          Live
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const reason =
                              window.prompt("Rejection reason (optional)") ?? undefined;
                            onReview({
                              pilotPropertyId: row.id,
                              action: "reject",
                              reason: reason?.trim() || undefined,
                            });
                          }}
                          className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-destructive disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminPilotLeadsSection({
  leads,
}: Readonly<{
  leads: Array<{
    id: string;
    lead_type: string;
    status: string;
    created_at: string;
  }>;
}>) {
  return (
    <section className="rounded-2xl border bg-card p-5 print:hidden">
      <h2 className="font-display text-lg font-semibold">Leads</h2>
      {leads.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No leads recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-140 text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="px-4 py-3 capitalize">{lead.lead_type}</td>
                  <td className="px-4 py-3">{lead.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
