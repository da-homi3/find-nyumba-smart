import { useMemo, useState, type SubmitEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createPilotPartnership,
  invitePartnerSelfServe,
  listCrmProspects,
  listPilotPartnerships,
  upsertCrmProspect,
  updatePilotLifecycle,
} from "@/lib/api/pilot-partnership.functions";
import {
  CRM_PIPELINE_STATUSES,
  PILOT_PARTNER_TYPES,
  type PilotPartnerType,
  type PilotStatus,
} from "@/lib/pilot/types";
import { AdminAsyncPanel, AdminField, StatusBadge } from "@/components/admin/admin-shared";

type PilotFilter = "all" | "applications" | "active" | "expiring" | "completed" | "converted";

type PilotRow = Awaited<ReturnType<typeof listPilotPartnerships>>[number];

const FILTERS: ReadonlyArray<readonly [PilotFilter, string]> = [
  ["all", "All"],
  ["applications", "Applications"],
  ["active", "Active"],
  ["expiring", "Expiring Soon"],
  ["completed", "Completed"],
  ["converted", "Converted"],
];

const APPLICATION_STATUSES = new Set<PilotStatus>(["INVITED", "APPLIED", "UNDER_REVIEW"]);
const ACTIVE_STATUSES = new Set<PilotStatus>(["ACTIVE", "EXTENDED", "ONBOARDING", "APPROVED", "PAUSED"]);

const PILOT_STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  INVITED: "bg-sky-500/10 text-sky-700",
  APPLIED: "bg-amber-500/10 text-amber-700",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700",
  APPROVED: "bg-emerald-500/10 text-emerald-700",
  ONBOARDING: "bg-sky-500/10 text-sky-700",
  ACTIVE: "bg-emerald-500/10 text-emerald-700",
  PAUSED: "bg-secondary text-muted-foreground",
  EXTENDED: "bg-emerald-500/10 text-emerald-700",
  COMPLETED: "bg-secondary text-muted-foreground",
  CONVERTED: "bg-emerald-500/15 text-emerald-800",
  DECLINED: "bg-red-500/10 text-red-600",
  CANCELLED: "bg-red-500/10 text-red-600",
};

function filterClass(active: boolean): string {
  return [
    "rounded-full px-3 py-1.5 text-xs font-semibold",
    active ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground",
  ].join(" ");
}

function matchesFilter(pilot: PilotRow, filter: PilotFilter): boolean {
  const status = pilot.status as PilotStatus;
  switch (filter) {
    case "all":
      return true;
    case "applications":
      return APPLICATION_STATUSES.has(status);
    case "active":
      return ACTIVE_STATUSES.has(status);
    case "expiring":
      return (
        ACTIVE_STATUSES.has(status) &&
        pilot.daysRemaining != null &&
        pilot.daysRemaining <= 7
      );
    case "completed":
      return status === "COMPLETED";
    case "converted":
      return status === "CONVERTED";
    default:
      return true;
  }
}

function partnerTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    REAL_ESTATE_AGENCY: "Real estate agency",
    PROPERTY_DEVELOPER: "Property developer",
    PROPERTY_MANAGER: "Property manager",
    LANDLORD: "Landlord",
    STUDENT_RESIDENCE: "Student residence",
    PROPERTY_OWNER: "Property owner",
    REAL_ESTATE_AGENT: "Real estate agent",
    OTHER: "Other",
  };
  return labels[type] ?? type.replaceAll("_", " ").toLowerCase();
}

export function AdminPartnershipsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PilotFilter>("all");

  const { data: pilots = [], isLoading: pilotsLoading } = useQuery({
    queryKey: ["admin-pilot-partnerships"],
    queryFn: () => listPilotPartnerships(),
  });

  const { data: crm, isLoading: crmLoading } = useQuery({
    queryKey: ["admin-crm-prospects"],
    queryFn: () => listCrmProspects(),
  });

  const filtered = useMemo(() => pilots.filter((p) => matchesFilter(p, filter)), [pilots, filter]);

  const lifecycle = useMutation({
    mutationFn: (payload: {
      pilotId: string;
      action: "approve" | "start_onboarding" | "activate" | "complete" | "convert";
      reason?: string;
    }) => updatePilotLifecycle({ data: payload }),
    onSuccess: () => {
      toast.success("Pilot updated");
      void qc.invalidateQueries({ queryKey: ["admin-pilot-partnerships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Partnership pilots</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite partners, track pilots, and manage the CRM pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={filterClass(filter === id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">CRM pipeline</h3>
        {crmLoading ? (
          <p className="text-sm text-muted-foreground">Loading CRM…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CRM_PIPELINE_STATUSES.map((status) => (
              <div key={status} className="rounded-2xl border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {status.replaceAll("_", " ")}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {crm?.counts?.[status] ?? 0}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <AdminAsyncPanel
        loading={pilotsLoading}
        loadingMessage="Loading pilots…"
        isEmpty={!pilotsLoading && filtered.length === 0}
        emptyContent={
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No pilots match this filter.
          </div>
        }
        skeletonCols={6}
      >
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Days left</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pilot) => (
                <tr key={pilot.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{pilot.partner_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {partnerTypeLabel(pilot.partner_type)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={pilot.status}
                      classMap={PILOT_STATUS_CLASS}
                      fallbackClass="bg-secondary text-muted-foreground"
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {pilot.daysRemaining == null ? "—" : `${pilot.daysRemaining}d`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <p>{pilot.primary_contact_email}</p>
                    {pilot.primary_contact_phone ? <p>{pilot.primary_contact_phone}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        to="/admin/partnerships/$pilotId"
                        params={{ pilotId: pilot.id }}
                        className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-secondary"
                      >
                        Open
                      </Link>
                      {pilot.status === "UNDER_REVIEW" ? (
                        <button
                          type="button"
                          disabled={lifecycle.isPending}
                          onClick={() =>
                            lifecycle.mutate({ pilotId: pilot.id, action: "approve" })
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : null}
                      {pilot.status === "APPROVED" ? (
                        <button
                          type="button"
                          disabled={lifecycle.isPending}
                          onClick={() =>
                            lifecycle.mutate({
                              pilotId: pilot.id,
                              action: "start_onboarding",
                            })
                          }
                          className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                        >
                          Onboard
                        </button>
                      ) : null}
                      {pilot.status === "ONBOARDING" ? (
                        <button
                          type="button"
                          disabled={lifecycle.isPending}
                          onClick={() =>
                            lifecycle.mutate({ pilotId: pilot.id, action: "activate" })
                          }
                          className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                        >
                          Activate
                        </button>
                      ) : null}
                      {pilot.status === "ACTIVE" || pilot.status === "EXTENDED" ? (
                        <>
                          <button
                            type="button"
                            disabled={lifecycle.isPending}
                            onClick={() =>
                              lifecycle.mutate({ pilotId: pilot.id, action: "complete" })
                            }
                            className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            disabled={lifecycle.isPending}
                            onClick={() =>
                              lifecycle.mutate({ pilotId: pilot.id, action: "convert" })
                            }
                            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            Convert
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminAsyncPanel>

      <SendPartnerInviteForm
        onCreated={() => void qc.invalidateQueries({ queryKey: ["admin-pilot-partnerships"] })}
      />

      <CreatePilotForm
        onCreated={() => void qc.invalidateQueries({ queryKey: ["admin-pilot-partnerships"] })}
      />
      <CreateCrmProspectForm
        onCreated={() => void qc.invalidateQueries({ queryKey: ["admin-crm-prospects"] })}
      />
    </div>
  );
}

function SendPartnerInviteForm({ onCreated }: Readonly<{ onCreated: () => void }>) {
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      invitePartnerSelfServe({
        data: {
          email: email.trim(),
          pilotDurationDays: duration,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      setLastInviteUrl(res.inviteUrl);
      void navigator.clipboard?.writeText(res.inviteUrl).catch(() => undefined);
      toast.success(
        res.emailSent
          ? "Invitation sent — they'll get dashboard access as soon as they accept"
          : "Invite link ready (email may have failed — copy the link below)",
      );
      setEmail("");
      setNotes("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    invite.mutate();
  }

  return (
    <section className="space-y-3 rounded-2xl border-2 border-primary/25 bg-primary/5 p-4 sm:p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Send invitation link</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the partner&apos;s email. They open the link, sign in, and get dashboard access
          immediately — no activation step. You&apos;ll be notified when they join. Profile details
          are optional for them.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <AdminField label="Partner email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@agency.co.ke"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
          />
        </AdminField>
        <AdminField label="Pilot days">
          <input
            required
            type="number"
            min={7}
            max={365}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm sm:w-28"
          />
        </AdminField>
        <button
          type="submit"
          disabled={invite.isPending}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {invite.isPending ? "Sending…" : "Send invite link"}
        </button>
      </form>
      <AdminField label="Internal note (optional)">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Met at Expo — follow up Anga Homes"
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </AdminField>
      {lastInviteUrl ? (
        <div className="rounded-xl border border-primary/20 bg-background p-3 text-sm">
          <p className="font-semibold">Share this link with the partner</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{lastInviteUrl}</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary"
            onClick={() => {
              void navigator.clipboard?.writeText(lastInviteUrl);
              toast.success("Invite link copied");
            }}
          >
            Copy link
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CreatePilotForm({ onCreated }: Readonly<{ onCreated: () => void }>) {
  const [partnerName, setPartnerName] = useState("");
  const [partnerType, setPartnerType] = useState<PilotPartnerType>("REAL_ESTATE_AGENCY");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [duration, setDuration] = useState(30);
  const [propertyCount, setPropertyCount] = useState(5);
  const [objectives, setObjectives] = useState("");
  const [kpiMetric, setKpiMetric] = useState("enquiries");
  const [kpiTarget, setKpiTarget] = useState(20);
  const [inviteNow, setInviteNow] = useState(true);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createPilotPartnership({
        data: {
          partnerName: partnerName.trim(),
          partnerType,
          primaryContactEmail: email.trim(),
          primaryContactPhone: phone.trim() || undefined,
          pilotDurationDays: duration,
          proposedPropertyCount: propertyCount,
          objectives: objectives
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          successCriteria:
            kpiMetric.trim() && kpiTarget > 0
              ? [{ metric: kpiMetric.trim(), target: kpiTarget, unit: "count" }]
              : [],
          inviteNow,
        },
      }),
    onSuccess: (res) => {
      const emailNote = res.emailSent ? "Invite email sent." : "Invite email may have failed — copy the link.";
      toast.success(
        res.inviteUrl
          ? `Pilot created. ${emailNote}`
          : "Pilot created as draft",
      );
      if (res.inviteUrl) {
        void navigator.clipboard?.writeText(res.inviteUrl).catch(() => undefined);
        setLastInviteUrl(res.inviteUrl);
      }
      setPartnerName("");
      setEmail("");
      setPhone("");
      setObjectives("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg font-semibold">Create pilot (advanced)</h3>
      <p className="text-sm text-muted-foreground">
        Prefill partner name and KPIs yourself. Prefer &quot;Send invitation link&quot; above when the
        partner should fill everything in.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <AdminField label="Partner name">
          <input
            required
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Partner type">
          <select
            value={partnerType}
            onChange={(e) => setPartnerType(e.target.value as PilotPartnerType)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            {PILOT_PARTNER_TYPES.map((type) => (
              <option key={type} value={type}>
                {partnerTypeLabel(type)}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Contact email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </AdminField>
        <AdminField label="Duration (days)">
          <input
            required
            type="number"
            min={7}
            max={365}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Proposed property count">
          <input
            type="number"
            min={0}
            max={500}
            value={propertyCount}
            onChange={(e) => setPropertyCount(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Objectives (one per line)" className="text-xs sm:col-span-2">
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Increase qualified enquiries&#10;Validate lead quality"
          />
        </AdminField>
        <AdminField label="KPI metric">
          <input
            value={kpiMetric}
            onChange={(e) => setKpiMetric(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="KPI target">
          <input
            type="number"
            min={0}
            value={kpiTarget}
            onChange={(e) => setKpiTarget(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={inviteNow}
            onChange={(e) => setInviteNow(e.target.checked)}
          />
          <span>Invite now (send invitation token)</span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create pilot"}
          </button>
        </div>
        {lastInviteUrl ? (
          <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-semibold">Invite link</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{lastInviteUrl}</p>
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-primary"
              onClick={() => {
                void navigator.clipboard?.writeText(lastInviteUrl);
                toast.success("Invite link copied");
              }}
            >
              Copy again
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function CreateCrmProspectForm({ onCreated }: Readonly<{ onCreated: () => void }>) {
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      upsertCrmProspect({
        data: {
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          pipelineStatus: "PROSPECT",
        },
      }),
    onSuccess: () => {
      toast.success("CRM prospect added");
      setCompanyName("");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setNotes("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg font-semibold">Add CRM prospect</h3>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <AdminField label="Company name">
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Contact person">
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <AdminField label="Notes" className="text-xs sm:col-span-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Add prospect"}
          </button>
        </div>
      </form>
    </section>
  );
}
