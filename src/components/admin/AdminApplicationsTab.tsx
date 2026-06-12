import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { AdminAsyncPanel, type PendingApplication } from "@/components/admin/admin-shared";

type Props = Readonly<{
  applications: PendingApplication[];
  loading: boolean;
  review: UseMutationResult<
    unknown,
    Error,
    { applicationId: string; action: "approve" | "reject"; rejectionReason?: string },
    unknown
  >;
}>;

export function AdminApplicationsTab({ applications, loading, review }: Props) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function confirmReject(applicationId: string) {
    review.mutate({
      applicationId,
      action: "reject",
      rejectionReason: rejectReason.trim() || undefined,
    });
    setRejectId(null);
    setRejectReason("");
  }

  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading applications…"
      isEmpty={applications.length === 0}
      emptyContent={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No pending portal applications.
        </div>
      }
    >
      <div className="space-y-4">
        {applications.map((app) => (
          <div
            key={app.id}
            className="rounded-2xl border bg-card p-5 flex flex-wrap justify-between gap-4"
          >
            <div>
              <p className="font-semibold capitalize">
                {app.requested_role} — {app.profiles?.full_name ?? "Applicant"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {app.organization_name && `${app.organization_name} · `}
                {app.phone ?? app.profiles?.phone} · {new Date(app.created_at).toLocaleString()}
              </p>
            </div>
            {rejectId === app.id ? (
              <div className="flex w-full flex-col gap-2 sm:w-72">
                <label className="text-xs font-semibold text-muted-foreground">
                  Rejection reason (optional)
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="e.g. incomplete documents"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmReject(app.id)}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Confirm reject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectId(null);
                      setRejectReason("");
                    }}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => review.mutate({ applicationId: app.id, action: "approve" })}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectId(app.id)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminAsyncPanel>
  );
}
