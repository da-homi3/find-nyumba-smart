import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  ListFilter, 
  Building2, 
  UserCheck, 
  History,
  ArrowLeft
} from "lucide-react";
import { 
  listAdminVerifications, 
  updateVerificationStatus, 
  listAdminScamReports, 
  updateScamReportStatus, 
  listAdminAuditLogs 
} from "@/lib/api/admin.functions";
import { listProperties } from "@/lib/api/nyumba.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Tab = "verifications" | "scams" | "properties" | "audits";

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("verifications");
  const qc = useQueryClient();

  // Queries
  const { data: verifications = [], isLoading: verLoading } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => listAdminVerifications(),
  });

  const { data: scams = [], isLoading: scamsLoading } = useQuery({
    queryKey: ["admin-scams"],
    queryFn: () => listAdminScamReports(),
  });

  const { data: properties = [], isLoading: propLoading } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => listProperties({ data: {} }),
  });

  const { data: audits = [], isLoading: auditsLoading } = useQuery({
    queryKey: ["admin-audits"],
    queryFn: () => listAdminAuditLogs(),
  });

  // Mutations
  const approveVerification = useMutation({
    mutationFn: async (id: string) => {
      await updateVerificationStatus({ data: { id, status: "approved" } });
    },
    onSuccess: () => {
      toast.success("Verification approved");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
  });

  const rejectVerification = useMutation({
    mutationFn: async (id: string) => {
      await updateVerificationStatus({ data: { id, status: "rejected" } });
    },
    onSuccess: () => {
      toast.success("Verification rejected");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
  });

  const resolveScam = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "reviewed" | "dismissed" }) => {
      await updateScamReportStatus({ data: { id, status } });
    },
    onSuccess: () => {
      toast.success("Scam report status updated");
      qc.invalidateQueries({ queryKey: ["admin-scams"] });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Admin header */}
      <header className="border-b bg-card py-4 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/tenant" className="p-1.5 rounded-full hover:bg-secondary">
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <h1 className="font-display text-xl font-bold">Admin Control Center</h1>
          </div>
          <div className="text-xs text-muted-foreground">Logged in as Administrator</div>
        </div>
      </header>

      {/* Tabs list */}
      <div className="mx-auto max-w-6xl px-6 mt-6">
        <div className="flex border-b text-xs font-semibold">
          {[
            { id: "verifications", label: "Verification Queue", count: verifications.filter((v: any) => v.status === "pending").length },
            { id: "scams", label: "Scam Reports", count: scams.filter((s: any) => s.status === "pending").length },
            { id: "properties", label: "Moderate listings", count: properties.length },
            { id: "audits", label: "Audit Logs", count: audits.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={`pb-3 px-4 -mb-px border-b-2 transition ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label} {t.count > 0 && <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px]">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div className="mt-6">
          {activeTab === "verifications" && (
            <div>
              {verLoading ? (
                <div className="text-sm text-muted-foreground">Loading queue...</div>
              ) : verifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
                  Verification queue is clean! No pending requests.
                </div>
              ) : (
                <div className="space-y-4">
                  {verifications.map((v: any) => (
                    <div key={v.id} className="rounded-2xl border bg-card p-5 shadow-soft flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-semibold">{v.profiles?.full_name ?? "Unknown User"}</strong>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase font-bold text-secondary-foreground">
                            {v.verification_type}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            v.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                            v.status === "rejected" ? "bg-red-500/10 text-red-600" :
                            "bg-amber-500/10 text-amber-600"
                          }`}>
                            {v.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Submitted on: {new Date(v.created_at).toLocaleString()}</div>
                        {v.documents && v.documents.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-xs font-semibold block">Attached Documents:</span>
                            {v.documents.map((doc: string, idx: number) => (
                              <a
                                key={idx}
                                href={doc}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline block truncate max-w-sm"
                              >
                                View Document #{idx + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {v.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => rejectVerification.mutate(v.id)}
                            className="rounded-xl border border-red-500/30 text-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/10"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => approveVerification.mutate(v.id)}
                            className="rounded-xl bg-gradient-emerald text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-soft hover:opacity-90"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "scams" && (
            <div>
              {scamsLoading ? (
                <div className="text-sm text-muted-foreground">Loading reports...</div>
              ) : scams.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
                  No scam reports. Platform is fully clear!
                </div>
              ) : (
                <div className="space-y-4">
                  {scams.map((s: any) => (
                    <div key={s.id} className="rounded-2xl border bg-card p-5 shadow-soft flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-semibold">Report #{s.id.slice(0, 8)}</strong>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.status === "reviewed" ? "bg-emerald-500/10 text-emerald-600" :
                            "bg-amber-500/10 text-amber-600"
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Property: <Link to="/tenant/property/$id" params={{ id: s.property_id }} className="text-primary hover:underline">{s.properties?.title}</Link></div>
                        <p className="mt-2 text-xs leading-relaxed"><strong className="text-foreground/80">Reason:</strong> {s.reason}</p>
                        {s.details && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.details}</p>}
                      </div>

                      {s.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => resolveScam.mutate({ id: s.id, status: "dismissed" })}
                            className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => resolveScam.mutate({ id: s.id, status: "reviewed" })}
                            className="rounded-xl bg-gradient-emerald text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-soft hover:opacity-90"
                          >
                            Mark Reviewed
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "properties" && (
            <div>
              {propLoading ? (
                <div className="text-sm text-muted-foreground">Loading listings...</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Property</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Verification Status</th>
                        <th className="px-4 py-3 text-left">Auth Score</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {properties.map((p: any) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-medium">
                            <Link to="/tenant/property/$id" params={{ id: p.id }} className="hover:underline">{p.title}</Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.neighborhood}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                              p.is_verified ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-500/10 text-gray-600"
                            }`}>
                              {p.is_verified ? "Verified" : "Unverified"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">{p.authenticity_score ?? 70}%</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${
                              p.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                            }`}>
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "audits" && (
            <div>
              {auditsLoading ? (
                <div className="text-sm text-muted-foreground">Loading audit logs...</div>
              ) : audits.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border bg-card text-xs">
                  <div className="bg-secondary p-3 font-semibold text-muted-foreground uppercase flex">
                    <span className="w-1/4">Date</span>
                    <span className="w-1/4">Action</span>
                    <span className="w-1/4">Admin</span>
                    <span className="w-1/4">Details</span>
                  </div>
                  <div className="divide-y">
                    {audits.map((a: any) => (
                      <div key={a.id} className="p-3 flex items-center hover:bg-secondary/40">
                        <span className="w-1/4 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                        <span className="w-1/4 font-semibold text-primary">{a.action}</span>
                        <span className="w-1/4">{a.admin?.full_name ?? "System"}</span>
                        <span className="w-1/4 text-muted-foreground truncate" title={a.details}>{a.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
