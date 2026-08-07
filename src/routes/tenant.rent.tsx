import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { formatKes } from "@/lib/properties";
import {
  listTenantPmInvoices,
  getTenantPmAccess,
  payPmRent,
} from "@/lib/api/pm-tenant-rent.functions";
import { pollPaymentUntilComplete } from "@/lib/payments/poll-payment-client";
import { PasteMpesaSmsPayment } from "@/components/pm/PasteMpesaSmsPayment";
import { SubmitOffAppPayment } from "@/components/pm/SubmitOffAppPayment";
import { isKenyanPhone } from "@/lib/phone";
import { nyumbaRentReceiptNo } from "@/lib/pm/rent-receipt";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenant/rent")({
  head: () => ({ meta: [{ title: "Your rent — NyumbaSearch" }] }),
  component: TenantRentPage,
});

type TenantInvoice = Awaited<ReturnType<typeof listTenantPmInvoices>>[number];
type OffAppMode = "claim" | "sms" | null;

type RentReceiptView = {
  amountPaid: number;
  invoiceTotal: number;
  balanceRemaining: number;
  propertyName: string | null;
  unitLabel: string | null;
  periodMonth: string;
  mpesaRef: string | null;
  nyumbaReceiptNo: string | null;
};

function TenantRentPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [offAppId, setOffAppId] = useState<string | null>(null);
  const [offAppMode, setOffAppMode] = useState<OffAppMode>(null);
  const [receipt, setReceipt] = useState<RentReceiptView | null>(null);

  const invoicesQ = useQuery({
    queryKey: ["tenant-pm-invoices", user?.id],
    enabled: Boolean(user),
    queryFn: () => listTenantPmInvoices(),
  });
  const accessQ = useQuery({
    queryKey: ["tenant-pm-access", user?.id],
    enabled: Boolean(user),
    queryFn: () => getTenantPmAccess(),
  });

  useEffect(() => {
    if (!accessQ.data?.invoiceCount) return;
    if ((invoicesQ.data?.length ?? 0) > 0) return;
    void qc.invalidateQueries({ queryKey: ["tenant-pm-invoices", user?.id] });
  }, [accessQ.data?.invoiceCount, invoicesQ.data?.length, qc, user?.id]);

  const showReceiptForInvoice = async (
    invoiceId: string,
    amountPaid: number,
    mpesaRef: string | null,
  ) => {
    const previous = (invoicesQ.data ?? []).find((i) => i.id === invoiceId);
    setPayingId(null);
    setOffAppId(null);
    setOffAppMode(null);

    // Optimistic receipt so the UI updates immediately after PIN confirm
    if (previous) {
      setReceipt({
        amountPaid,
        invoiceTotal: previous.amount_due + previous.late_fee,
        balanceRemaining: Math.max(0, previous.balance_remaining - amountPaid),
        propertyName: previous.property_name,
        unitLabel: previous.unit_label,
        periodMonth: previous.period_month,
        mpesaRef,
        nyumbaReceiptNo: null,
      });
    }

    await qc.invalidateQueries({ queryKey: ["tenant-pm-invoices"] });
    await qc.invalidateQueries({ queryKey: ["tenant-pm-access"] });
    const refreshed = await listTenantPmInvoices();
    qc.setQueryData(["tenant-pm-invoices", user?.id], refreshed);

    const inv = refreshed.find((i) => i.id === invoiceId) ?? previous;
    if (!inv) return;
    const payRow =
      (inv.payments ?? []).find((p) => Math.round(Number(p.amount)) === amountPaid) ??
      inv.payments?.[0];
    setReceipt({
      amountPaid,
      invoiceTotal: inv.amount_due + inv.late_fee,
      balanceRemaining: inv.balance_remaining,
      propertyName: inv.property_name,
      unitLabel: inv.unit_label,
      periodMonth: inv.period_month,
      mpesaRef: mpesaRef ?? payRow?.mpesa_receipt_number ?? null,
      nyumbaReceiptNo: payRow ? nyumbaRentReceiptNo(payRow.id) : null,
    });
  };

  const pay = useMutation({
    mutationFn: (invoiceId: string) => {
      const amountKes = Math.round(Number(payAmount));
      if (!Number.isFinite(amountKes) || amountKes <= 0) {
        throw new Error("Enter a valid amount to pay");
      }
      if (!isKenyanPhone(phone)) {
        throw new Error("Enter a valid Safaricom number (07… or 01…)");
      }
      return payPmRent({
        data: {
          invoiceId,
          phone,
          amountKes,
          // Unique per tap so cancelled/failed STKs can be re-prompted
          idempotencyKey: `rent-${invoiceId.slice(0, 8)}-${amountKes}-${Date.now()}`.slice(0, 64),
        },
      }).then((res) => ({ ...res, invoiceId, amountKes }));
    },
    onSuccess: async (res) => {
      if (res.status === "completed") {
        toast.success("Rent paid — receipt emailed");
        await showReceiptForInvoice(
          res.invoiceId,
          res.amountKes,
          typeof res.message === "string" && /DEMO/i.test(res.message) ? "DEMO" : null,
        );
        return;
      }
      toast.message(res.message ?? "Check your phone for the M-Pesa prompt");
      if (!res.paymentId) {
        toast.error("Could not start M-Pesa prompt — try again");
        return;
      }
      await pollRentPayment(res.paymentId, res.invoiceId, res.amountKes, showReceiptForInvoice);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <CenteredSpinner />;
  if (!user) return <SignInPrompt />;

  const invoices = invoicesQ.data ?? [];
  const current = invoices.find((i) => i.status !== "paid");

  return (
    <div className={cn("mx-auto max-w-lg px-4 py-8")}>
      <h1 className={cn("font-display text-2xl font-semibold")}>Your rent</h1>
      <p className={cn("mt-1 text-sm text-muted-foreground")}>
        Pay with M-Pesa in the app, paste an M-Pesa SMS you already paid with, or record cash/bank.{" "}
        <Link to="/tenant/complaints" className="font-semibold text-primary">
          File a complaint →
        </Link>{" "}
        <Link to="/tenant/maintenance" className="font-semibold text-primary">
          Maintenance →
        </Link>
      </p>

      {receipt ? <RentPaidReceipt receipt={receipt} onDismiss={() => setReceipt(null)} /> : null}

      <RentBody
        isLoading={invoicesQ.isLoading || accessQ.isLoading}
        access={accessQ.data}
        invoices={invoices}
        current={current}
        payingId={payingId}
        offAppId={offAppId}
        offAppMode={offAppMode}
        phone={phone}
        payAmount={payAmount}
        payPending={pay.isPending}
        onPhoneChange={setPhone}
        onPayAmountChange={setPayAmount}
        onStartPay={(inv) => {
          setReceipt(null);
          setOffAppId(null);
          setOffAppMode(null);
          setPayingId(inv.id);
          setPhone(inv.default_mpesa_phone ?? "");
          setPayAmount(String(inv.balance_remaining));
        }}
        onCancelPay={() => setPayingId(null)}
        onSubmitPay={(id) => pay.mutate(id)}
        onStartOffApp={(inv, mode) => {
          setReceipt(null);
          setPayingId(null);
          setOffAppId(inv.id);
          setOffAppMode(mode);
        }}
        onCancelOffApp={() => {
          setOffAppId(null);
          setOffAppMode(null);
        }}
        onOffAppDone={() => {
          setOffAppId(null);
          setOffAppMode(null);
          qc.invalidateQueries({ queryKey: ["tenant-pm-invoices"] });
        }}
      />

      <button
        type="button"
        className={cn("mt-8 text-sm text-muted-foreground underline")}
        onClick={() => navigate({ to: "/tenant/profile" })}
      >
        Account settings
      </button>
    </div>
  );
}

async function pollRentPayment(
  paymentId: string,
  invoiceId: string,
  amountKes: number,
  onPaid: (invoiceId: string, amountPaid: number, mpesaRef: string | null) => Promise<void>,
) {
  try {
    const done = await pollPaymentUntilComplete(paymentId, {
      onMessage: (message) => {
        if (message) toast.message(message);
      },
    });
    toast.success("Payment confirmed — receipt emailed");
    await onPaid(invoiceId, amountKes, done.receipt ?? null);
  } catch (err) {
    const text = err instanceof Error ? err.message : "Payment failed or was cancelled";
    if (/timed out/i.test(text)) {
      toast.message("Still confirming M-Pesa — pull to refresh Rent in a moment");
      return;
    }
    toast.error(text);
  }
}

function RentPaidReceipt(props: Readonly<{ receipt: RentReceiptView; onDismiss: () => void }>) {
  const { receipt } = props;
  const fullyPaid = receipt.balanceRemaining <= 0;

  return (
    <output
      className={cn("mt-6 block rounded-2xl border border-primary/35 bg-primary/10 px-5 py-5")}
    >
      <p className={cn("text-xs font-semibold uppercase tracking-wide text-primary")}>
        NyumbaSearch receipt
      </p>
      {receipt.nyumbaReceiptNo ? (
        <p className={cn("mt-1 font-mono text-xs text-muted-foreground")}>
          {receipt.nyumbaReceiptNo}
        </p>
      ) : null}
      <p className={cn("mt-3 text-3xl font-semibold tabular-nums text-primary")}>
        {formatKes(receipt.amountPaid)}
      </p>
      <p className={cn("mt-1 text-sm text-muted-foreground")}>Amount paid just now</p>

      <dl className={cn("mt-4 space-y-2 text-sm")}>
        <div className={cn("flex justify-between gap-3")}>
          <dt className={cn("text-muted-foreground")}>Property</dt>
          <dd className={cn("text-right font-medium")}>
            {receipt.propertyName ?? "—"}
            {receipt.unitLabel ? ` · ${receipt.unitLabel}` : ""}
          </dd>
        </div>
        <div className={cn("flex justify-between gap-3")}>
          <dt className={cn("text-muted-foreground")}>Period</dt>
          <dd className={cn("font-medium")}>{receipt.periodMonth}</dd>
        </div>
        <div className={cn("flex justify-between gap-3")}>
          <dt className={cn("text-muted-foreground")}>Invoice total</dt>
          <dd className={cn("font-medium tabular-nums")}>{formatKes(receipt.invoiceTotal)}</dd>
        </div>
        <div className={cn("flex justify-between gap-3")}>
          <dt className={cn("text-muted-foreground")}>Balance remaining</dt>
          <dd className={cn("font-semibold tabular-nums")}>
            {fullyPaid ? "KES 0 — paid in full" : formatKes(receipt.balanceRemaining)}
          </dd>
        </div>
        {receipt.mpesaRef ? (
          <div className={cn("flex justify-between gap-3")}>
            <dt className={cn("text-muted-foreground")}>M-Pesa ref</dt>
            <dd className={cn("font-mono text-xs")}>{receipt.mpesaRef}</dd>
          </div>
        ) : null}
      </dl>

      <p className={cn("mt-4 text-xs text-muted-foreground")}>
        A copy of this receipt was emailed to you and your property owner.
      </p>
      <button
        type="button"
        onClick={props.onDismiss}
        className={cn(
          "mt-4 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background",
        )}
      >
        Done
      </button>
    </output>
  );
}

function CenteredSpinner() {
  return (
    <div className={cn("flex min-h-[40vh] items-center justify-center")}>
      <Loader2 className={cn("h-6 w-6 animate-spin text-muted-foreground")} />
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className={cn("mx-auto max-w-md px-4 py-16 text-center")}>
      <h1 className={cn("text-xl font-semibold")}>Sign in to view rent</h1>
      <p className={cn("mt-2 text-sm text-muted-foreground")}>
        After your landlord invites you and attaches a lease, you can pay rent here.
      </p>
      <Link
        to="/auth"
        search={{ mode: "signin", redirect: "/tenant/rent" }}
        className={cn(
          "mt-6 inline-block rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background",
        )}
      >
        Sign in
      </Link>
    </div>
  );
}

function RentEmptyState({
  access,
}: Readonly<{ access: Awaited<ReturnType<typeof getTenantPmAccess>> | undefined }>) {
  let title = "No rent invoices yet";
  let detail = "Ask your landlord to invite you to the tenancy portal, then attach your lease.";
  if (access?.linked && !access.hasActiveLease) {
    title = "You’re linked — waiting on a lease";
    detail =
      "Your invite is accepted. Ask your landlord to attach a lease (unit + rent) so invoices appear here. Complaints and maintenance unlock once a lease is active.";
  } else if (access?.linked && access.hasActiveLease) {
    title = "Lease active — invoices syncing";
    detail =
      "Your tenancy is linked. Pull to refresh in a moment, or ask your landlord to confirm the lease monthly rent.";
  } else if (access && !access.linked) {
    title = "Not linked to a tenancy yet";
    detail =
      "Open the invitation link from your landlord’s email, sign in, and accept. Then they must attach your lease for rent payments.";
  }

  return (
    <div
      className={cn(
        "mt-8 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground",
      )}
    >
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2">{detail}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link to="/tenant/complaints" className="font-semibold text-primary">
          Complaints →
        </Link>
        <Link to="/tenant/maintenance" className="font-semibold text-primary">
          Maintenance →
        </Link>
      </div>
    </div>
  );
}

function RentBody(
  props: Readonly<{
    isLoading: boolean;
    access: Awaited<ReturnType<typeof getTenantPmAccess>> | undefined;
    invoices: TenantInvoice[];
    current: TenantInvoice | undefined;
    payingId: string | null;
    offAppId: string | null;
    offAppMode: OffAppMode;
    phone: string;
    payAmount: string;
    payPending: boolean;
    onPhoneChange: (v: string) => void;
    onPayAmountChange: (v: string) => void;
    onStartPay: (inv: TenantInvoice) => void;
    onCancelPay: () => void;
    onSubmitPay: (id: string) => void;
    onStartOffApp: (inv: TenantInvoice, mode: "claim" | "sms") => void;
    onCancelOffApp: () => void;
    onOffAppDone: () => void;
  }>,
) {
  if (props.isLoading) {
    return (
      <div className={cn("flex justify-center py-16")}>
        <Loader2 className={cn("h-6 w-6 animate-spin text-muted-foreground")} />
      </div>
    );
  }

  if (props.invoices.length === 0) {
    return <RentEmptyState access={props.access} />;
  }

  const { current } = props;

  return (
    <>
      {current ? (
        <CurrentInvoiceCard
          invoice={current}
          paying={props.payingId === current.id}
          offAppMode={props.offAppId === current.id ? props.offAppMode : null}
          phone={props.phone}
          payAmount={props.payAmount}
          payPending={props.payPending}
          onPhoneChange={props.onPhoneChange}
          onPayAmountChange={props.onPayAmountChange}
          onStartPay={() => props.onStartPay(current)}
          onCancelPay={props.onCancelPay}
          onSubmitPay={() => props.onSubmitPay(current.id)}
          onStartOffApp={(mode) => props.onStartOffApp(current, mode)}
          onCancelOffApp={props.onCancelOffApp}
          onOffAppDone={props.onOffAppDone}
        />
      ) : (
        <p className={cn("mt-6 text-sm text-muted-foreground")}>
          All invoices are paid. Nice work.
        </p>
      )}

      <h2
        className={cn("mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground")}
      >
        Payment history
      </h2>
      <ul className={cn("mt-3 space-y-2")}>
        {props.invoices.map((inv) => (
          <InvoiceHistoryRow key={inv.id} invoice={inv} />
        ))}
      </ul>
    </>
  );
}

function CurrentInvoiceCard(
  props: Readonly<{
    invoice: TenantInvoice;
    paying: boolean;
    offAppMode: OffAppMode;
    phone: string;
    payAmount: string;
    payPending: boolean;
    onPhoneChange: (v: string) => void;
    onPayAmountChange: (v: string) => void;
    onStartPay: () => void;
    onCancelPay: () => void;
    onSubmitPay: () => void;
    onStartOffApp: (mode: "claim" | "sms") => void;
    onCancelOffApp: () => void;
    onOffAppDone: () => void;
  }>,
) {
  const { invoice } = props;
  const overdue = invoice.status === "overdue";
  const borderClass = overdue
    ? "border-destructive/40 bg-destructive/5"
    : "border-border bg-background";

  return (
    <div className={cn("mt-6 rounded-2xl border px-5 py-5", borderClass)}>
      <p className={cn("text-xs uppercase tracking-wide text-muted-foreground")}>
        {invoice.period_month} · Due {invoice.due_date}
        {invoice.unit_label ? ` · Unit ${invoice.unit_label}` : ""}
      </p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums")}>
        {formatKes(invoice.balance_remaining)}
      </p>
      {invoice.property_name ? (
        <p className={cn("mt-1 text-sm text-muted-foreground")}>{invoice.property_name}</p>
      ) : null}
      {overdue && invoice.late_fee > 0 ? (
        <p className={cn("mt-2 text-sm text-destructive")}>
          Overdue — includes {formatKes(invoice.late_fee)} late fee
        </p>
      ) : null}

      {props.paying ? (
        <PayRentForm
          phone={props.phone}
          balance={invoice.balance_remaining}
          payAmount={props.payAmount}
          payPending={props.payPending}
          onPhoneChange={props.onPhoneChange}
          onPayAmountChange={props.onPayAmountChange}
          onCancel={props.onCancelPay}
          onSubmit={props.onSubmitPay}
        />
      ) : null}

      {props.offAppMode === "sms" ? (
        <PasteMpesaSmsPayment
          invoiceId={invoice.id}
          balanceRemaining={invoice.balance_remaining}
          onDone={props.onOffAppDone}
          onCancel={props.onCancelOffApp}
        />
      ) : null}

      {props.offAppMode === "claim" ? (
        <SubmitOffAppPayment
          invoiceId={invoice.id}
          defaultAmount={invoice.balance_remaining}
          onDone={props.onOffAppDone}
          onCancel={props.onCancelOffApp}
        />
      ) : null}

      {!props.paying && !props.offAppMode ? (
        <div className={cn("mt-4 space-y-2")}>
          <button
            type="button"
            className={cn(
              "w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background",
            )}
            onClick={props.onStartPay}
          >
            Pay with M-Pesa
          </button>
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted",
            )}
            onClick={() => props.onStartOffApp("sms")}
          >
            Paste M-Pesa payment message
          </button>
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted",
            )}
            onClick={() => props.onStartOffApp("claim")}
          >
            Cash / bank / other (needs landlord confirm)
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PayRentForm(
  props: Readonly<{
    phone: string;
    balance: number;
    payAmount: string;
    payPending: boolean;
    onPhoneChange: (v: string) => void;
    onPayAmountChange: (v: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
  }>,
) {
  const amountNum = Math.round(Number(props.payAmount));
  const amountOk = Number.isFinite(amountNum) && amountNum >= 1 && amountNum <= props.balance;
  const phoneOk = isKenyanPhone(props.phone);
  const canSubmit = amountOk && phoneOk && !props.payPending;
  const amountLabel = amountOk ? formatKes(amountNum) : "…";

  useEffect(() => {
    if (!props.payAmount) props.onPayAmountChange(String(props.balance));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when form opens
  }, []);

  return (
    <form
      className={cn("mt-4 space-y-3")}
      onSubmit={(e) => {
        e.preventDefault();
        if (!amountOk) {
          toast.error(`Enter an amount between KES 1 and ${formatKes(props.balance)}`);
          return;
        }
        if (!phoneOk) {
          toast.error("Enter a valid Safaricom number (07… or 01…)");
          return;
        }
        props.onSubmit();
      }}
    >
      <label className={cn("block text-xs")}>
        <span className={cn("block font-medium")}>Amount to pay (KES)</span>
        <input
          required
          type="number"
          min={1}
          max={props.balance}
          inputMode="numeric"
          value={props.payAmount}
          onChange={(e) => props.onPayAmountChange(e.target.value)}
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-base")}
        />
        <span className={cn("mt-1 block text-[11px] text-muted-foreground")}>
          Balance due {formatKes(props.balance)}. You can pay a partial amount.
        </span>
      </label>
      <label className={cn("block text-xs")}>
        <span className={cn("block font-medium")}>M-Pesa phone</span>
        <input
          required
          value={props.phone}
          onChange={(e) => props.onPhoneChange(e.target.value)}
          placeholder="07XXXXXXXX"
          inputMode="tel"
          autoComplete="tel"
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-base")}
        />
        {props.phone.trim() && !phoneOk ? (
          <span className={cn("mt-1 block text-[11px] text-destructive")}>
            Use a Kenyan mobile like 0712 345 678
          </span>
        ) : null}
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className={cn(
          "w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60",
        )}
      >
        {props.payPending ? "Sending STK…" : `Prompt M-Pesa for ${amountLabel}`}
      </button>
      <button
        type="button"
        className={cn("w-full text-xs text-muted-foreground")}
        onClick={props.onCancel}
      >
        Cancel
      </button>
    </form>
  );
}

function InvoiceHistoryRow({ invoice }: Readonly<{ invoice: TenantInvoice }>) {
  const totalDue = invoice.amount_due + invoice.late_fee;
  const payments = invoice.payments ?? [];

  return (
    <li className={cn("rounded-xl border border-border px-4 py-3 text-sm")}>
      <div className={cn("flex items-center justify-between gap-3")}>
        <div>
          <div className={cn("font-medium")}>
            {invoice.period_month}
            {invoice.unit_label ? ` · ${invoice.unit_label}` : ""}
          </div>
          <div className={cn("text-xs text-muted-foreground")}>
            Paid {formatKes(invoice.amount_paid)} of {formatKes(totalDue)}
            {invoice.balance_remaining > 0
              ? ` · balance ${formatKes(invoice.balance_remaining)}`
              : ""}
          </div>
        </div>
        <span className={cn("text-xs uppercase tracking-wide text-muted-foreground")}>
          {invoice.status}
        </span>
      </div>
      {payments.length > 0 ? (
        <ul className={cn("mt-2 space-y-1.5 border-t border-border pt-2")}>
          {payments.map((p) => (
            <li key={p.id} className={cn("text-xs text-muted-foreground")}>
              <div className={cn("font-medium text-foreground")}>
                {formatKes(p.amount)} · {nyumbaRentReceiptNo(p.id)}
              </div>
              <div>
                {new Date(p.paid_at).toLocaleString("en-KE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {p.mpesa_receipt_number ? ` · M-Pesa ${p.mpesa_receipt_number}` : ` · ${p.method}`}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
