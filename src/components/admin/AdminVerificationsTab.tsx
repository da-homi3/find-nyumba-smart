import type { UseMutationResult } from "@tanstack/react-query";
import {
  AdminAsyncPanel,
  StatusBadge,
  VERIFICATION_STATUS_CLASS,
  type AdminVerification,
} from "@/components/admin/admin-shared";

type Props = Readonly<{
  verifications: AdminVerification[];
  loading: boolean;
  approve: UseMutationResult<void, Error, string, unknown>;
  reject: UseMutationResult<void, Error, string, unknown>;
}>;

export function AdminVerificationsTab({ verifications, loading, approve, reject }: Props) {
  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading queue..."
      isEmpty={verifications.length === 0}
      emptyContent={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Verification queue is clean! No pending requests.
        </div>
      }
    >
      <div className="space-y-4">
        {verifications.map((v) => (
          <div
            key={v.id}
            className="rounded-2xl border bg-card p-5 shadow-soft flex flex-wrap justify-between items-start gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-semibold">
                  {v.profiles?.full_name ?? "Unknown User"}
                </strong>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase font-bold text-secondary-foreground">
                  {v.verification_type}
                </span>
                <StatusBadge
                  status={v.status}
                  classMap={VERIFICATION_STATUS_CLASS}
                  fallbackClass="bg-amber-500/10 text-amber-600"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Submitted on: {new Date(v.created_at).toLocaleString()}
              </div>
              {v.documents && v.documents.length > 0 && (
                <div className="mt-3 space-y-1">
                  <span className="text-xs font-semibold block">Attached Documents:</span>
                  {v.documents.map((doc: string) => (
                    <a
                      key={doc}
                      href={doc}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline block truncate max-w-sm"
                    >
                      View document
                    </a>
                  ))}
                </div>
              )}
            </div>

            {v.status === "pending" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reject.mutate(v.id)}
                  className="rounded-xl border border-red-500/30 text-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/10"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => approve.mutate(v.id)}
                  className="rounded-xl bg-gradient-emerald text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-soft hover:opacity-90"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminAsyncPanel>
  );
}
