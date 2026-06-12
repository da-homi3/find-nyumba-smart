import { Link } from "@tanstack/react-router";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  AdminAsyncPanel,
  SCAM_STATUS_CLASS,
  StatusBadge,
  type AdminScamReport,
} from "@/components/admin/admin-shared";

type Props = Readonly<{
  scams: AdminScamReport[];
  loading: boolean;
  resolve: UseMutationResult<
    void,
    Error,
    { id: string; status: "reviewed" | "dismissed" },
    unknown
  >;
}>;

export function AdminScamsTab({ scams, loading, resolve }: Props) {
  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading reports..."
      isEmpty={scams.length === 0}
      emptyContent={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No scam reports. Platform is fully clear!
        </div>
      }
    >
      <div className="space-y-4">
        {scams.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border bg-card p-5 shadow-soft flex flex-wrap justify-between items-start gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-semibold">Report #{s.id.slice(0, 8)}</strong>
                <StatusBadge
                  status={s.status}
                  classMap={SCAM_STATUS_CLASS}
                  fallbackClass="bg-amber-500/10 text-amber-600"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Property:{" "}
                <Link
                  to="/tenant/property/$id"
                  params={{ id: s.property_id }}
                  className="text-primary hover:underline"
                >
                  {s.properties?.title}
                </Link>
              </div>
              <p className="mt-2 text-xs leading-relaxed">
                <strong className="text-foreground/80">Reason:</strong> {s.reason}
              </p>
              {s.details && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.details}</p>
              )}
            </div>

            {s.status === "pending" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resolve.mutate({ id: s.id, status: "dismissed" })}
                  className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => resolve.mutate({ id: s.id, status: "reviewed" })}
                  className="rounded-xl bg-gradient-emerald text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-soft hover:opacity-90"
                >
                  Mark Reviewed
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminAsyncPanel>
  );
}
