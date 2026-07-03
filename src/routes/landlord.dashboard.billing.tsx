import { createFileRoute, Link } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/payment.functions";
import { formatKes } from "@/lib/properties";
import { LEAD_PACKS } from "@/lib/revenue/plans";

type BillingPayment = Awaited<ReturnType<typeof listTransactions>>[number];

export const Route = createFileRoute("/landlord/dashboard/billing")({
  component: () => (
    <LandlordShell>
      <BillingPage />
    </LandlordShell>
  ),
});

function BillingPage() {
  const { data: payments = [] } = useQuery<BillingPayment[]>({
    queryKey: ["billing-payments"],
    queryFn: () => listTransactions(),
  });

  const totalDue = payments
    .filter((p) => p.status === "completed")
    .slice(0, 3)
    .reduce((s, p) => s + p.amount_kes, 0);

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Subscriptions, boosts, lead packs, and platform fees.
      </p>

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Recent charges (sample)</p>
        <p className="mt-1 font-display text-2xl font-semibold">{formatKes(totalDue || 0)}</p>
        <button
          type="button"
          onClick={() => globalThis.print()}
          className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          Download invoice (print)
        </button>
        <Link
          to="/landlord/checkout"
          search={{ product: "leads", qty: 25 }}
          className="ml-2 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Pay now
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Buy lead packs</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {LEAD_PACKS.map((pack) => (
            <Link
              key={pack.qty}
              to="/landlord/checkout"
              search={{ product: "leads", qty: pack.qty }}
              className="rounded-2xl border bg-card p-4 hover:border-primary/30"
            >
              <p className="font-semibold">{pack.label}</p>
              <p className="mt-1 text-primary">{formatKes(pack.priceKes)}</p>
            </Link>
          ))}
        </div>
      </section>

      <ul className="mt-8 space-y-2 text-sm">
        {payments.slice(0, 10).map((p) => (
          <li key={p.id} className="flex justify-between rounded-xl border px-4 py-3">
            <span>{p.payment_type.replaceAll("_", " ")}</span>
            <span className="font-semibold">{formatKes(p.amount_kes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
