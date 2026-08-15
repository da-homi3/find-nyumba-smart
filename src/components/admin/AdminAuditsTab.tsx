import { AdminAsyncPanel, type AdminAuditLog } from "@/components/admin/admin-shared";

type Props = Readonly<{
  audits: AdminAuditLog[];
  loading: boolean;
}>;

function formatAction(action: string): string {
  return action.replaceAll("_", " ");
}

export function AdminAuditsTab({ audits, loading }: Props) {
  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading audit logs..."
      isEmpty={audits.length === 0}
      emptyContent={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No audit logs recorded yet.
        </div>
      }
    >
      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {audits.map((a) => (
          <article key={a.id} className="rounded-2xl border bg-card p-3.5 text-sm">
            <p className="text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleString()}
            </p>
            <p className="mt-1.5 font-semibold break-words text-primary">
              {formatAction(a.action)}
            </p>
            <p className="mt-1 text-foreground">{a.admin?.full_name ?? "System"}</p>
            {a.details ? (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a.details}</p>
            ) : null}
          </article>
        ))}
      </div>

      {/* Desktop: horizontal scroll table so columns never overlap */}
      <div className="hidden overflow-x-auto rounded-2xl border bg-card text-xs md:block">
        <div className="min-w-[720px]">
          <div className="flex bg-secondary p-3 font-semibold uppercase text-muted-foreground">
            <span className="w-[22%] shrink-0">Date</span>
            <span className="w-[28%] shrink-0">Action</span>
            <span className="w-[20%] shrink-0">Admin</span>
            <span className="w-[30%] shrink-0">Details</span>
          </div>
          <div className="divide-y">
            {audits.map((a) => (
              <div key={a.id} className="flex items-start p-3 hover:bg-secondary/40">
                <span className="w-[22%] shrink-0 pr-2 text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <span className="w-[28%] shrink-0 break-words pr-2 font-semibold text-primary">
                  {a.action}
                </span>
                <span className="w-[20%] shrink-0 truncate pr-2">
                  {a.admin?.full_name ?? "System"}
                </span>
                <span
                  className="w-[30%] shrink-0 truncate text-muted-foreground"
                  title={a.details ?? undefined}
                >
                  {a.details}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminAsyncPanel>
  );
}
