import type { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminAsyncPanel,
  StatusBadge,
  type AdminPropertyCheck,
} from "@/components/admin/admin-shared";

const STATUS_CLASS: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-red-500/10 text-red-600",
  in_progress: "bg-blue-500/10 text-blue-600",
  pending: "bg-amber-500/10 text-amber-600",
};

type Props = Readonly<{
  requests: AdminPropertyCheck[];
  loading: boolean;
  update: UseMutationResult<
    unknown,
    Error,
    {
      id: string;
      status?: "pending" | "in_progress" | "completed" | "cancelled";
      report_url?: string | null;
    },
    unknown
  >;
}>;

export function AdminPropertyChecksTab({ requests, loading, update }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading property verification requests..."
      isEmpty={requests.length === 0}
      emptyContent={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No paid property verification requests yet.
        </div>
      }
    >
      <div className="space-y-4">
        {requests.map((req) => {
          const reportDraft = drafts[req.id] ?? req.report_url ?? "";
          return (
            <div
              key={req.id}
              className="rounded-2xl border bg-card p-5 shadow-soft flex flex-wrap justify-between items-start gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm font-semibold">{req.requester_name}</strong>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase font-bold text-secondary-foreground">
                    {req.tier}
                  </span>
                  <StatusBadge
                    status={req.status}
                    classMap={STATUS_CLASS}
                    fallbackClass="bg-amber-500/10 text-amber-600"
                  />
                  {req.paid ? (
                    <span className="text-[10px] font-semibold text-emerald-600">Paid</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600">Unpaid</span>
                  )}
                </div>
                <p className="mt-1 text-sm">{req.property_address}</p>
                <p className="text-xs text-muted-foreground">
                  {req.requester_email} · {req.requester_phone}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted {new Date(req.created_at).toLocaleString()} · KES{" "}
                  {req.amount_paid_kes.toLocaleString()}
                </p>
                {req.listing_url ? (
                  <a
                    href={req.listing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    View listing →
                  </a>
                ) : null}
                {req.report_url ? (
                  <a
                    href={req.report_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 ml-3 inline-block text-xs text-primary hover:underline"
                  >
                    Current report →
                  </a>
                ) : null}
              </div>

              <div className="w-full max-w-sm space-y-3">
                <label className="block text-xs font-semibold">
                  Report URL (PDF or hosted link)
                  <input
                    type="url"
                    value={reportDraft}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [req.id]: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {req.status !== "in_progress" && req.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={() => update.mutate({ id: req.id, status: "in_progress" })}
                      className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      Mark in progress
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      update.mutate({
                        id: req.id,
                        report_url: reportDraft.trim() || null,
                        status: reportDraft.trim() ? "completed" : undefined,
                      })
                    }
                    className="rounded-xl bg-gradient-emerald px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90"
                  >
                    Save report link
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AdminAsyncPanel>
  );
}
