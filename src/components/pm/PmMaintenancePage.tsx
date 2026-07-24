import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  assignPmMaintenanceProvider,
  listPmMaintenanceRequests,
  listProvidersForMaintenance,
  updatePmMaintenanceStatus,
} from "@/lib/api/pm-maintenance.functions";
import {
  MAINTENANCE_CATEGORIES,
  STATUS_LABELS,
  type MaintenanceCategory,
  type MaintenanceStatus,
  canTransition,
} from "@/lib/maintenance/state-machine";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  reported: "border-amber-500",
  assigned: "border-sky-500",
  accepted: "border-sky-500",
  in_progress: "border-primary",
  completed: "border-violet-500",
  confirmed: "border-muted-foreground",
};

type RequestRow = Awaited<ReturnType<typeof listPmMaintenanceRequests>>["requests"][number];
type ProviderRow = Awaited<ReturnType<typeof listProvidersForMaintenance>>["providers"][number];

export function PmMaintenancePage({
  portal,
  propertyId,
}: Readonly<{ portal: PmPortal; propertyId: string }>) {
  const qc = useQueryClient();
  const [assignFor, setAssignFor] = useState<RequestRow | null>(null);

  const listQ = useQuery({
    queryKey: ["pm-maintenance", propertyId],
    queryFn: () => listPmMaintenanceRequests({ data: { propertyId } }),
  });

  const statusMut = useMutation({
    mutationFn: (opts: { requestId: string; status: MaintenanceStatus }) =>
      updatePmMaintenanceStatus({ data: opts }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["pm-maintenance", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requests = listQ.data?.requests ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-semibold">Maintenance</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Assign jobs to verified providers from the NyumbaSearch directory.
      </p>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="maintenance" />
      </div>

      <MaintenanceQueueBody
        loading={listQ.isLoading}
        requests={requests}
        statusPending={statusMut.isPending}
        onAssign={setAssignFor}
        onStatus={(requestId, status) => statusMut.mutate({ requestId, status })}
      />

      {assignFor ? (
        <AssignProviderModal
          propertyId={propertyId}
          request={assignFor}
          countyHint={listQ.data?.propertyCounty ?? undefined}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null);
            qc.invalidateQueries({ queryKey: ["pm-maintenance", propertyId] });
            qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
          }}
        />
      ) : null}
    </div>
  );
}

function MaintenanceQueueBody({
  loading,
  requests,
  statusPending,
  onAssign,
  onStatus,
}: Readonly<{
  loading: boolean;
  requests: RequestRow[];
  statusPending: boolean;
  onAssign: (row: RequestRow) => void;
  onStatus: (requestId: string, status: MaintenanceStatus) => void;
}>) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No maintenance requests yet. Tenants report issues from their portal.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li
          key={r.id}
          className={cn(
            "rounded-2xl border border-border/60 bg-card p-4 shadow-soft border-l-4",
            STATUS_COLOR[r.status] ?? "border-l-muted",
            r.priority === "urgent" && "bg-destructive/5",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold capitalize">
                {r.category} — Unit {r.unit_label}
                {r.priority === "urgent" ? (
                  <span className="ml-2 text-xs font-bold uppercase text-destructive">Urgent</span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
              {r.assigned_provider_name ? (
                <p className="mt-1 text-xs text-primary">Provider: {r.assigned_provider_name}</p>
              ) : null}
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {STATUS_LABELS[r.status as MaintenanceStatus] ?? r.status}
            </span>
          </div>
          {r.photos?.length ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {r.photos.map((url: string) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {r.status === "reported" ? (
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                onClick={() => onAssign(r)}
              >
                Assign a provider
              </button>
            ) : null}
            {canTransition(r.status, "in_progress") ? (
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                disabled={statusPending}
                onClick={() => onStatus(r.id, "in_progress")}
              >
                Mark in progress
              </button>
            ) : null}
            {canTransition(r.status, "completed") ? (
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                disabled={statusPending}
                onClick={() => onStatus(r.id, "completed")}
              >
                Mark completed
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AssignProviderModal({
  propertyId,
  request,
  countyHint,
  onClose,
  onAssigned,
}: Readonly<{
  propertyId: string;
  request: RequestRow;
  countyHint?: string;
  onClose: () => void;
  onAssigned: () => void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const providersQ = useQuery({
    queryKey: ["pm-maintenance-providers", propertyId, request.category, countyHint],
    queryFn: () =>
      listProvidersForMaintenance({
        data: {
          propertyId,
          category: request.category as MaintenanceCategory,
          county: countyHint,
        },
      }),
  });

  const assign = useMutation({
    mutationFn: (providerId: string) =>
      assignPmMaintenanceProvider({
        data: { requestId: request.id, providerId },
      }),
    onSuccess: (res) => {
      toast.success(`Assigned to ${res.providerName}`);
      if (res.providerWhatsAppUrl) {
        window.open(res.providerWhatsAppUrl, "_blank", "noopener,noreferrer");
      }
      onAssigned();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) el.showModal();
    function onCancel(e: Event) {
      e.preventDefault();
      onClose();
    }
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const categoryLabel = MAINTENANCE_CATEGORIES.includes(request.category as MaintenanceCategory)
    ? request.category
    : "service";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="assign-provider-title"
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 open:flex open:items-end open:justify-center open:bg-black/50 open:p-4 sm:open:items-center"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-5 shadow-elegant">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="assign-provider-title" className="font-display text-lg font-semibold">
              Assign a provider
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Showing verified {categoryLabel} providers
              {countyHint ? ` near ${countyHint}` : ""}.
            </p>
          </div>
          <button type="button" className="text-sm text-muted-foreground" onClick={onClose}>
            Close
          </button>
        </div>

        <ProviderPickerBody
          loading={providersQ.isLoading}
          providers={providersQ.data?.providers ?? []}
          assigning={assign.isPending}
          onAssign={(id) => assign.mutate(id)}
        />
      </div>
    </dialog>
  );
}

function ProviderPickerBody({
  loading,
  providers,
  assigning,
  onAssign,
}: Readonly<{
  loading: boolean;
  providers: ProviderRow[];
  assigning: boolean;
  onAssign: (providerId: string) => void;
}>) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No directory providers found for this category yet.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {providers.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.businessName}</p>
            <p className="text-[11px] text-muted-foreground">
              {p.verified ? "Verified contact" : "Unverified — confirm before relying"}
              {p.priceRange ? ` · ${p.priceRange}` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={assigning}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => onAssign(p.id)}
          >
            Assign
          </button>
        </li>
      ))}
    </ul>
  );
}
