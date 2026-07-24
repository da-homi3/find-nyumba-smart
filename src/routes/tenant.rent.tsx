import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { formatKes } from "@/lib/properties";
import { listTenantPmInvoices, payPmRent } from "@/lib/api/pm-tenant-rent.functions";
import { verifyPaymentStatus } from "@/lib/api/payment.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenant/rent")({
  head: () => ({ meta: [{ title: "Your rent — NyumbaSearch" }] }),
  component: TenantRentPage,
});

type TenantInvoice = Awaited<ReturnType<typeof listTenantPmInvoices>>[number];

function TenantRentPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const invoicesQ = useQuery({
    queryKey: ["tenant-pm-invoices", user?.id],
    enabled: Boolean(user),
    queryFn: () => listTenantPmInvoices(),
  });

  const pay = useMutation({
    mutationFn: (invoiceId: string) =>
      payPmRent({
        data: {
          invoiceId,
          phone,
          idempotencyKey: `rent-${invoiceId}`,
        },
      }),
    onSuccess: async (res) => {
      if (res.status === "completed") {
        toast.success("Rent paid");
        qc.invalidateQueries({ queryKey: ["tenant-pm-invoices"] });
        setPayingId(null);
        return;
      }
      toast.message("Check your phone for the M-Pesa prompt");
      if (!res.paymentId) return;
      await pollRentPayment(res.paymentId, qc, () => setPayingId(null));
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
        Pay with M-Pesa after your landlord links your tenancy.{" "}
        <Link to="/tenant/maintenance" className="font-semibold text-primary">
          Report a maintenance issue →
        </Link>
      </p>

      <RentBody
        isLoading={invoicesQ.isLoading}
        invoices={invoices}
        current={current}
        payingId={payingId}
        phone={phone}
        payPending={pay.isPending}
        onPhoneChange={setPhone}
        onStartPay={(inv) => {
          setPayingId(inv.id);
          setPhone(inv.default_mpesa_phone ?? "");
        }}
        onCancelPay={() => setPayingId(null)}
        onSubmitPay={(id) => pay.mutate(id)}
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
  qc: ReturnType<typeof useQueryClient>,
  onPaid: () => void,
) {
  for (let i = 0; i < 12; i += 1) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const status = await verifyPaymentStatus({ data: { paymentId } });
      if (status.status === "completed") {
        toast.success("Rent payment confirmed");
        qc.invalidateQueries({ queryKey: ["tenant-pm-invoices"] });
        onPaid();
        return;
      }
      if (status.status === "failed") {
        toast.error("Payment failed or was cancelled");
        return;
      }
    } catch {
      // keep polling
    }
  }
  toast.message("Still waiting for M-Pesa — refresh this page in a moment");
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
        Pay rent only after accepting a landlord portal invite.
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

function RentBody(
  props: Readonly<{
    isLoading: boolean;
    invoices: TenantInvoice[];
    current: TenantInvoice | undefined;
    payingId: string | null;
    phone: string;
    payPending: boolean;
    onPhoneChange: (v: string) => void;
    onStartPay: (inv: TenantInvoice) => void;
    onCancelPay: () => void;
    onSubmitPay: (id: string) => void;
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
    return (
      <div
        className={cn(
          "mt-8 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground",
        )}
      >
        No rent invoices yet. Ask your landlord to invite you to the tenancy portal.
      </div>
    );
  }

  const { current } = props;

  return (
    <>
      {current ? (
        <CurrentInvoiceCard
          invoice={current}
          paying={props.payingId === current.id}
          phone={props.phone}
          payPending={props.payPending}
          onPhoneChange={props.onPhoneChange}
          onStartPay={() => props.onStartPay(current)}
          onCancelPay={props.onCancelPay}
          onSubmitPay={() => props.onSubmitPay(current.id)}
        />
      ) : (
        <p className={cn("mt-6 text-sm text-muted-foreground")}>All invoices are paid. Nice work.</p>
      )}

      <h2 className={cn("mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground")}>
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
    phone: string;
    payPending: boolean;
    onPhoneChange: (v: string) => void;
    onStartPay: () => void;
    onCancelPay: () => void;
    onSubmitPay: () => void;
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
          payPending={props.payPending}
          onPhoneChange={props.onPhoneChange}
          onCancel={props.onCancelPay}
          onSubmit={props.onSubmitPay}
        />
      ) : (
        <button
          type="button"
          className={cn(
            "mt-4 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background",
          )}
          onClick={props.onStartPay}
        >
          Pay rent
        </button>
      )}
    </div>
  );
}

function PayRentForm(
  props: Readonly<{
    phone: string;
    balance: number;
    payPending: boolean;
    onPhoneChange: (v: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
  }>,
) {
  return (
    <form
      className={cn("mt-4 space-y-3")}
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <label className={cn("block text-xs")}>
        <span className={cn("block font-medium")}>M-Pesa phone</span>
        <input
          required
          value={props.phone}
          onChange={(e) => props.onPhoneChange(e.target.value)}
          placeholder="07XXXXXXXX"
          className={cn("mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm")}
        />
      </label>
      <button
        type="submit"
        disabled={props.payPending}
        className={cn(
          "w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60",
        )}
      >
        {props.payPending ? "Sending STK…" : `Pay ${formatKes(props.balance)}`}
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
  return (
    <li
      className={cn(
        "flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm",
      )}
    >
      <div>
        <div className={cn("font-medium")}>
          {invoice.period_month}
          {invoice.unit_label ? ` · ${invoice.unit_label}` : ""}
        </div>
        <div className={cn("text-xs text-muted-foreground")}>
          {formatKes(invoice.amount_paid)} / {formatKes(invoice.amount_due + invoice.late_fee)}
        </div>
      </div>
      <span className={cn("text-xs uppercase tracking-wide text-muted-foreground")}>
        {invoice.status}
      </span>
    </li>
  );
}
