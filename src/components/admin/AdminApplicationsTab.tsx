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
  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading applications…"
      isEmpty={applications.length === 0}
      empty={
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
                onClick={() => {
                  const reason = prompt("Rejection reason (optional):") ?? undefined;
                  review.mutate({
                    applicationId: app.id,
                    action: "reject",
                    rejectionReason: reason,
                  });
                }}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminAsyncPanel>
  );
}
