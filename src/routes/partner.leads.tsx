import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { useActivePilotId, usePilotDetail } from "@/hooks/use-partner-pilot";
import { updatePilotLeadStatus } from "@/lib/api/pilot-partnership.functions";
import { PILOT_LEAD_STATUSES, type PilotLeadStatus } from "@/lib/pilot/types";

export const Route = createFileRoute("/partner/leads")({
  head: () => ({ meta: [{ title: "Pilot leads — NyumbaSearch" }] }),
  component: () => (
    <PartnerShell>
      <PartnerLeadsPage />
    </PartnerShell>
  ),
});

function PartnerLeadsPage() {
  const qc = useQueryClient();
  const { pilotId } = useActivePilotId();
  const { data, isLoading } = usePilotDetail(pilotId);
  const leads = data?.leads ?? [];

  const updateStatus = useMutation({
    mutationFn: (payload: { leadId: string; status: PilotLeadStatus }) =>
      updatePilotLeadStatus({ data: payload }),
    onSuccess: () => {
      toast.success("Lead updated");
      void qc.invalidateQueries({ queryKey: ["pilot-detail", pilotId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enquiries and contact intent attributed to your pilot listings.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {leads.length} total
        </span>
      </header>

      {isLoading ? (
        <div className="mt-8 flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No leads yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Leads appear when tenants enquire, call, WhatsApp, or request a viewing.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="px-4 py-3 capitalize">{lead.lead_type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {lead.property_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      disabled={updateStatus.isPending}
                      onChange={(e) =>
                        updateStatus.mutate({
                          leadId: lead.id,
                          status: e.target.value as PilotLeadStatus,
                        })
                      }
                      className="rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary/50"
                    >
                      {PILOT_LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
