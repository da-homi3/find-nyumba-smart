import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAdminPmOverview, resolveAdminPmDispute } from "@/lib/api/pm-admin.functions";
import { formatKes } from "@/lib/properties";
import { AdminAsyncPanel } from "@/components/admin/admin-shared";

type AdminPmOverview = {
  activePmSubscriptions: Array<{
    id: string;
    user_id: string;
    plan: string;
    status: string;
    amount_kes: number;
    trial_end: string | null;
    next_billing_date: string;
    created_at: string;
    full_name: string | null;
  }>;
  openDisputes: Array<{
    id: string;
    related_id: string;
    reason: string;
    claim: Record<string, unknown> | null;
  }>;
  recentReversals: Array<{
    id: string;
    amount: number;
    reversal_reason: string | null;
    paid_at: string;
    reversal_of_payment_id: string | null;
  }>;
};

export function AdminPmTab() {
  const qc = useQueryClient();
  const overviewQ = useQuery({
    queryKey: ["admin-pm-overview"],
    queryFn: async () => (await getAdminPmOverview()) as AdminPmOverview,
  });

  const resolve = useMutation({
    mutationFn: (payload: {
      disputeId: string;
      outcome: "uphold_tenant" | "uphold_landlord";
      notes: string;
    }) => resolveAdminPmDispute({ data: payload }),
    onSuccess: () => {
      toast.success("Dispute resolved");
      qc.invalidateQueries({ queryKey: ["admin-pm-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (overviewQ.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const data = overviewQ.data;
  if (!data) {
    return <p className="text-sm text-muted-foreground">Could not load PM overview.</p>;
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          PM subscriptions
        </h2>
        <AdminAsyncPanel
          loading={false}
          loadingMessage=""
          isEmpty={data.activePmSubscriptions.length === 0}
          emptyContent={<p className="mt-3 text-sm text-muted-foreground">No PM subscriptions yet.</p>}
        >
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {data.activePmSubscriptions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{s.full_name ?? s.user_id}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.plan} · {s.status} · {formatKes(s.amount_kes)}/mo
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  Next bill {new Date(s.next_billing_date).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </AdminAsyncPanel>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Open payment claim disputes
        </h2>
        <AdminAsyncPanel
          loading={false}
          loadingMessage=""
          isEmpty={data.openDisputes.length === 0}
          emptyContent={<p className="mt-3 text-sm text-muted-foreground">No open disputes.</p>}
        >
          <ul className="mt-3 space-y-3">
            {data.openDisputes.map((d) => {
              const claim = d.claim as
                | {
                    id: string;
                    amount_claimed: number;
                    method: string;
                    paid_on_date: string;
                    attachment_url: string | null;
                    note: string | null;
                  }
                | null;
              return (
                <li key={d.id} className="rounded-xl border border-border px-4 py-3 text-sm">
                  <p className="font-medium">
                    {claim
                      ? `${formatKes(claim.amount_claimed)} · ${claim.method.replaceAll("_", " ")}`
                      : "Claim"}
                  </p>
                  <p className="text-xs text-muted-foreground">Landlord reason: {d.reason}</p>
                  {claim?.attachment_url ? (
                    <a
                      href={claim.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary underline"
                    >
                      View proof
                    </a>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={resolve.isPending}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => {
                        const notes = window.prompt("Resolution notes (required)");
                        if (!notes?.trim()) return;
                        resolve.mutate({
                          disputeId: d.id,
                          outcome: "uphold_tenant",
                          notes: notes.trim(),
                        });
                      }}
                    >
                      Uphold tenant (credit)
                    </button>
                    <button
                      type="button"
                      disabled={resolve.isPending}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                      onClick={() => {
                        const notes = window.prompt("Resolution notes (required)");
                        if (!notes?.trim()) return;
                        resolve.mutate({
                          disputeId: d.id,
                          outcome: "uphold_landlord",
                          notes: notes.trim(),
                        });
                      }}
                    >
                      Uphold landlord
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </AdminAsyncPanel>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent reversals
        </h2>
        <AdminAsyncPanel
          loading={false}
          loadingMessage=""
          isEmpty={data.recentReversals.length === 0}
          emptyContent={<p className="mt-3 text-sm text-muted-foreground">No reversals logged.</p>}
        >
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {data.recentReversals.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{formatKes(r.amount)} reversal</div>
                <div className="text-xs text-muted-foreground">
                  {r.reversal_reason ?? "No reason"} · of {r.reversal_of_payment_id} ·{" "}
                  {new Date(r.paid_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </AdminAsyncPanel>
      </section>
    </div>
  );
}
