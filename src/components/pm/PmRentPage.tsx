import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatKes } from "@/lib/properties";
import {
  getPmProperty,
  listPmInvoices,
  recordPmPayment,
  updatePmInvoiceAmountDue,
  updatePmLeaseRent,
} from "@/lib/api/pm.functions";
import { listPmPaymentClaims } from "@/lib/api/pm-module.functions";
import { rentBalanceRemaining } from "@/lib/pm/invoice-status";
import { nyumbaRentReceiptNo } from "@/lib/pm/rent-receipt";
import { PaymentClaimCard, type PmPaymentClaim } from "@/components/pm/PaymentClaimCard";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";

type PmInvoice = Awaited<ReturnType<typeof listPmInvoices>>[number];

const METHOD_LABEL: Record<string, string> = {
  manual: "Manual",
  cash: "Cash",
  bank: "Bank",
  mpesa: "M-Pesa (in-app)",
  mpesa_sms: "M-Pesa SMS",
};

function periodYear(periodMonth: string): string {
  return periodMonth.slice(0, 4);
}

function smsSnippet(note: string | null): string | null {
  if (!note) return null;
  if (!/M-Pesa SMS auto-record/i.test(note)) return null;
  const parts = note.split(/\n\n/);
  const body = parts.length > 1 ? parts.slice(1).join("\n\n") : note;
  return body.trim().slice(0, 280);
}

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
  const claimsQ = useQuery({
    queryKey: ["pm-payment-claims", propertyId],
    queryFn: () => listPmPaymentClaims({ data: { propertyId, status: "pending" } }),
  });

  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editScope, setEditScope] = useState<"invoice" | "lease">("invoice");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"manual" | "cash" | "bank">("manual");
  const [expandedSms, setExpandedSms] = useState<string | null>(null);

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

  const editRent = useMutation({
    mutationFn: async (inv: PmInvoice) => {
      if (editScope === "lease") {
        return updatePmLeaseRent({
          data: {
            leaseId: inv.lease_id,
            monthlyRent: editAmount,
            applyToCurrentInvoice: true,
          },
        });
      }
      return updatePmInvoiceAmountDue({
        data: { invoiceId: inv.id, amountDue: editAmount },
      });
    },
    onSuccess: () => {
      toast.success(
        editScope === "lease"
          ? "Lease monthly rent updated (this month’s invoice adjusted)"
          : "Invoice amount updated for this month",
      );
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["pm-invoices", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-leases", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoices: PmInvoice[] = invoicesQ.data ?? [];
  const claims = (claimsQ.data ?? []) as PmPaymentClaim[];

  const totals = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const thisYear = String(now.getUTCFullYear());
    let collectedMonth = 0;
    let collectedYear = 0;
    let outstanding = 0;
    for (const inv of invoices) {
      collectedYear += periodYear(inv.period_month) === thisYear ? inv.amount_paid : 0;
      collectedMonth += inv.period_month === thisMonth ? inv.amount_paid : 0;
      outstanding += rentBalanceRemaining(inv.amount_due, inv.amount_paid, inv.late_fee);
    }
    return { thisMonth, thisYear, collectedMonth, collectedYear, outstanding };
  }, [invoices]);

  if (detail.isLoading || invoicesQ.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!detail.data) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">{detail.data.property.name} · Rent</h1>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="rent" />
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Collected · {totals.thisMonth}
          </div>
          <div className="mt-1 text-xl font-semibold">{formatKes(totals.collectedMonth)}</div>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Collected · {totals.thisYear} YTD
          </div>
          <div className="mt-1 text-xl font-semibold">{formatKes(totals.collectedYear)}</div>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Outstanding balance
          </div>
          <div className="mt-1 text-xl font-semibold">{formatKes(totals.outstanding)}</div>
        </div>
      </section>

      {claims.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tenant payment claims
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirm to credit the ledger, or dispute to escalate to NyumbaSearch. Claims are never
            silently deleted.
          </p>
          <div className="mt-3 space-y-2">
            {claims.map((claim) => (
              <PaymentClaimCard key={claim.id} claim={claim} propertyId={propertyId} />
            ))}
          </div>
        </section>
      ) : null}

      {invoices.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No invoices yet. Monthly cron creates one per active lease (or seed via lease + cron).
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Tenant / unit</th>
                <th className="px-3 py-2.5 font-medium">Period</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-3 py-2.5 font-medium">Paid</th>
                <th className="px-3 py-2.5 font-medium">Left</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const balance = rentBalanceRemaining(
                  inv.amount_due,
                  inv.amount_paid,
                  inv.late_fee,
                );
                const totalDue = inv.amount_due + inv.late_fee;
                const smsPays = (inv.payments ?? []).filter((p) => p.method === "mpesa_sms");
                return (
                  <tr key={inv.id} className="border-b border-border/70 align-top last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-medium">{inv.tenant_name ?? "Tenant"}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.unit_label ? `Unit ${inv.unit_label}` : "—"}
                        {inv.lease_monthly_rent != null
                          ? ` · lease ${formatKes(inv.lease_monthly_rent)}/mo`
                          : ""}
                      </div>
                      {smsPays.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {smsPays.map((p) => {
                            const snip = smsSnippet(p.note);
                            return (
                              <div key={p.id} className="rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                                <div className="font-medium text-foreground">
                                  Pasted SMS · {formatKes(p.amount)}
                                  {p.mpesa_receipt_number
                                    ? ` · ${p.mpesa_receipt_number}`
                                    : ""}
                                </div>
                                {snip ? (
                                  <>
                                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                      {expandedSms === p.id ? p.note : snip}
                                      {snip.length >= 280 && expandedSms !== p.id ? "…" : ""}
                                    </p>
                                    <button
                                      type="button"
                                      className="mt-1 text-[11px] font-semibold text-foreground underline-offset-2 hover:underline"
                                      onClick={() =>
                                        setExpandedSms((cur) => (cur === p.id ? null : p.id))
                                      }
                                    >
                                      {expandedSms === p.id ? "Hide full message" : "Show full"}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {inv.payments && inv.payments.length > 0 && smsPays.length === 0 ? (
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {inv.payments.slice(0, 3).map((p) => (
                            <li key={p.id}>
                              {formatKes(p.amount)} · {METHOD_LABEL[p.method] ?? p.method}
                              {p.mpesa_receipt_number ? ` · ${p.mpesa_receipt_number}` : ""}
                              {" · "}
                              {nyumbaRentReceiptNo(p.id)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div>{inv.period_month}</div>
                      <div className="text-xs text-muted-foreground">Due {inv.due_date}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatKes(totalDue)}
                      {inv.late_fee > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          incl. {formatKes(inv.late_fee)} late
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatKes(inv.amount_paid)}</td>
                    <td className="px-3 py-3 whitespace-nowrap font-medium">
                      {formatKes(balance)}
                    </td>
                    <td className="px-3 py-3 uppercase text-xs tracking-wide">{inv.status}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {inv.status !== "paid" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingId(inv.id);
                              setEditingId(null);
                              setAmount(balance);
                            }}
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                          >
                            Record
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(inv.id);
                            setPayingId(null);
                            setEditAmount(inv.amount_due);
                            setEditScope("invoice");
                          }}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                        >
                          Edit rent
                        </button>
                      </div>
                      {payingId === inv.id ? (
                        <form
                          className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2"
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
                      {editingId === inv.id ? (
                        <form
                          className="mt-2 space-y-2 border-t border-border pt-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            editRent.mutate(inv);
                          }}
                        >
                          <label className="block text-xs">
                            <span className="block">Amount (KES)</span>
                            <input
                              type="number"
                              min={0}
                              required
                              value={editAmount}
                              onChange={(e) => setEditAmount(Number(e.target.value))}
                              className="mt-1 block w-32 rounded-lg border border-border px-2 py-1.5 text-sm"
                            />
                          </label>
                          <fieldset className="space-y-1 text-xs">
                            <legend className="font-medium">Apply to</legend>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`scope-${inv.id}`}
                                checked={editScope === "invoice"}
                                onChange={() => setEditScope("invoice")}
                              />
                              <span>This month’s invoice only</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`scope-${inv.id}`}
                                checked={editScope === "lease"}
                                onChange={() => setEditScope("lease")}
                              />
                              <span>Monthly lease rent (and this month)</span>
                            </label>
                          </fieldset>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={editRent.isPending}
                              className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
