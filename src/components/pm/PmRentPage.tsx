import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatKes } from "@/lib/properties";
import { getPmProperty, listPmInvoices, recordPmPayment } from "@/lib/api/pm.functions";
import { rentBalanceRemaining } from "@/lib/pm/invoice-status";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";

type PmInvoice = Awaited<ReturnType<typeof listPmInvoices>>[number];

export function PmRentPage({
  portal,
  propertyId,
}: Readonly<{ portal: PmPortal; propertyId: string }>) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["pm-property", propertyId],
    queryFn: () => getPmProperty({ data: { propertyId } }),
  });
  const invoicesQ = useQuery({
    queryKey: ["pm-invoices", propertyId],
    queryFn: () => listPmInvoices({ data: { propertyId } }),
  });

  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"manual" | "cash" | "bank">("manual");

  const pay = useMutation({
    mutationFn: () =>
      recordPmPayment({
        data: {
          invoiceId: payingId!,
          amount,
          method,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Payment recorded · ${res.status}`);
      setPayingId(null);
      setAmount(0);
      qc.invalidateQueries({ queryKey: ["pm-invoices", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading || invoicesQ.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!detail.data) return null;

  const invoices: PmInvoice[] = invoicesQ.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">
        {detail.data.property.name} · Rent
      </h1>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="rent" />
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No invoices yet. Monthly cron creates one per active lease (or seed via lease + cron).
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => {
            const balance = rentBalanceRemaining(inv.amount_due, inv.amount_paid, inv.late_fee);
            const totalDue = inv.amount_due + inv.late_fee;
            return (
              <li key={inv.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {inv.period_month}
                      {inv.unit_label ? ` · Unit ${inv.unit_label}` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Due {inv.due_date} · {formatKes(inv.amount_paid)} / {formatKes(totalDue)}
                      {inv.late_fee > 0 ? ` (incl. ${formatKes(inv.late_fee)} late fee)` : ""} ·{" "}
                      <span className="uppercase">{inv.status}</span>
                    </div>
                  </div>
                  {inv.status !== "paid" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPayingId(inv.id);
                        setAmount(balance);
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Record payment
                    </button>
                  ) : null}
                </div>
                {payingId === inv.id ? (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      pay.mutate();
                    }}
                  >
                    <label className="text-xs">
                      <span className="block">Amount</span>
                      <input
                        type="number"
                        min={1}
                        required
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="mt-1 block w-28 rounded-lg border border-border px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="block">Method</span>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value as typeof method)}
                        className="mt-1 block rounded-lg border border-border px-2 py-1.5 text-sm"
                      >
                        <option value="manual">Manual</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={pay.isPending}
                      className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayingId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
