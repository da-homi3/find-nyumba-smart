import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAdminPlatformFeeSummary, retryPayoutBatch } from "@/lib/api/pm-payout.functions";
import { formatKes } from "@/lib/properties";
import { AdminAsyncPanel } from "@/components/admin/admin-shared";

export function AdminPayoutsTab() {
  const qc = useQueryClient();
  const summaryQ = useQuery({
    queryKey: ["admin-platform-fees"],
    queryFn: () => getAdminPlatformFeeSummary(),
  });

  const retry = useMutation({
    mutationFn: (batchId: string) => retryPayoutBatch({ data: { batchId } }),
    onSuccess: (res) => {
      toast.success(`Retry finished · ${res.status}`);
      qc.invalidateQueries({ queryKey: ["admin-platform-fees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (summaryQ.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const data = summaryQ.data;
  if (!data) {
    return <p className="text-sm text-muted-foreground">Could not load fee summary.</p>;
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            MTD platform fee (1%)
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {formatKes(data.monthToDatePlatformFeeRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-border px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            MTD fee transactions
          </p>
          <p className="mt-1 text-2xl font-semibold">{data.monthToDateTransactionCount}</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Failed payout batches
        </h2>
        <AdminAsyncPanel
          loading={false}
          loadingMessage=""
          isEmpty={data.failedPayoutBatches.length === 0}
          emptyContent={
            <p className="mt-3 text-sm text-muted-foreground">No failed payouts. Nice.</p>
          }
        >
          <ul className="mt-3 space-y-2">
            {data.failedPayoutBatches.map(
              (b: {
                id: string;
                owner_user_id: string;
                total_net_payout: number;
                failure_reason: string | null;
                attempts: number;
                created_at: string;
              }) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{formatKes(b.total_net_payout)} net</div>
                    <div className="text-xs text-muted-foreground">
                      Owner {b.owner_user_id.slice(0, 8)}… · {b.failure_reason ?? "Unknown"} ·{" "}
                      {b.attempts} attempt(s)
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(b.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    Retry
                  </button>
                </li>
              ),
            )}
          </ul>
        </AdminAsyncPanel>
      </section>
    </div>
  );
}
