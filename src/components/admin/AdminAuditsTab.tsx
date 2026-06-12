import { AdminAsyncPanel, type AdminAuditLog } from "@/components/admin/admin-shared";

type Props = Readonly<{
  audits: AdminAuditLog[];
  loading: boolean;
}>;

export function AdminAuditsTab({ audits, loading }: Props) {
  return (
    <AdminAsyncPanel
      loading={loading}
      loadingMessage="Loading audit logs..."
      isEmpty={audits.length === 0}
      empty={
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No audit logs recorded yet.
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl border bg-card text-xs">
        <div className="bg-secondary p-3 font-semibold text-muted-foreground uppercase flex">
          <span className="w-1/4">Date</span>
          <span className="w-1/4">Action</span>
          <span className="w-1/4">Admin</span>
          <span className="w-1/4">Details</span>
        </div>
        <div className="divide-y">
          {audits.map((a) => (
            <div key={a.id} className="p-3 flex items-center hover:bg-secondary/40">
              <span className="w-1/4 text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </span>
              <span className="w-1/4 font-semibold text-primary">{a.action}</span>
              <span className="w-1/4">{a.admin?.full_name ?? "System"}</span>
              <span className="w-1/4 text-muted-foreground truncate" title={a.details ?? undefined}>
                {a.details}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminAsyncPanel>
  );
}
