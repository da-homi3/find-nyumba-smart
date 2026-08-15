import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteNav } from "@/components/SiteNav";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PremiumFeatureLock } from "@/components/PremiumFeatureLock";
import { formatKes } from "@/lib/properties";
import { TENANT_PLUS_CONFIG } from "@/lib/revenue/tenant-plus-config";
import { getFinancialPartners } from "@/lib/api/revenue.functions";

export const Route = createFileRoute("/tenant/finance")({
  component: TenantFinanceToolsPage,
});

function TenantFinanceToolsPage() {
  const { isPlus, loading } = useEntitlements();
  const { data: partners = [] } = useQuery({
    queryKey: ["financial-partners"],
    enabled: isPlus,
    queryFn: () => getFinancialPartners(),
  });
  const [income, setIncome] = useState("80000");
  const [expenses, setExpenses] = useState("20000");
  const [rent, setRent] = useState("45000");
  const [depositMonths, setDepositMonths] = useState("1");
  const [moving, setMoving] = useState("8000");
  const [savings, setSavings] = useState("20000");
  const [monthlySave, setMonthlySave] = useState("10000");

  const afford = useMemo(() => {
    const inc = Number(income) || 0;
    const exp = Number(expenses) || 0;
    const r = Number(rent) || 0;
    const leftover = inc - exp - r;
    const suggestedMax = Math.round(inc * 0.3);
    return { leftover, suggestedMax, housingShare: inc > 0 ? Math.round((r / inc) * 100) : 0 };
  }, [income, expenses, rent]);

  const moveIn = useMemo(() => {
    const r = Number(rent) || 0;
    const dep = r * (Number(depositMonths) || 0);
    const move = Number(moving) || 0;
    return { total: r + dep + move, deposit: dep, rent: r, move };
  }, [rent, depositMonths, moving]);

  const goal = useMemo(() => {
    const target = moveIn.total;
    const have = Number(savings) || 0;
    const perMonth = Number(monthlySave) || 0;
    const remaining = Math.max(0, target - have);
    const months = perMonth > 0 ? Math.ceil(remaining / perMonth) : null;
    const pct = target > 0 ? Math.min(100, Math.round((have / target) * 100)) : 0;
    return { remaining, months, pct, target };
  }, [moveIn.total, savings, monthlySave]);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav variant="light" />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-semibold">Financial tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimates only — not financial advice. NyumbaSearch does not lend money.
        </p>
        {!loading && TENANT_PLUS_CONFIG.flags.financialServicesEnabled && !isPlus ? (
          <div className="mt-8">
            <PremiumFeatureLock
              title="Financial Services"
              body="Plan rent affordability, move-in cash, and savings toward your next home."
            />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Affordability</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs">
                  Monthly income
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  Other expenses
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={expenses}
                    onChange={(e) => setExpenses(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  Target rent
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={rent}
                    onChange={(e) => setRent(e.target.value)}
                  />
                </label>
              </div>
              <p className="mt-3 text-sm">
                Suggested rent cap (30% of income): <strong>{formatKes(afford.suggestedMax)}</strong>
                . Housing share {afford.housingShare}%. Leftover after rent+expenses:{" "}
                <strong>{formatKes(afford.leftover)}</strong>.
              </p>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Move-in plan</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  Deposit (months of rent)
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={depositMonths}
                    onChange={(e) => setDepositMonths(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  Moving costs
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={moving}
                    onChange={(e) => setMoving(e.target.value)}
                  />
                </label>
              </div>
              <p className="mt-3 text-sm">
                First month {formatKes(moveIn.rent)} + deposit {formatKes(moveIn.deposit)} + moving{" "}
                {formatKes(moveIn.move)} = <strong>{formatKes(moveIn.total)}</strong>
              </p>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Savings toward move-in</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  Current savings
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={savings}
                    onChange={(e) => setSavings(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  Monthly saving
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={monthlySave}
                    onChange={(e) => setMonthlySave(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${goal.pct}%` }} />
              </div>
              <p className="mt-2 text-sm">
                {goal.pct}% of {formatKes(goal.target)}. Remaining {formatKes(goal.remaining)}
                {goal.months != null ? ` · about ${goal.months} month(s) at this rate` : ""}.
              </p>
            </section>
            {partners.length > 0 ? (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="font-semibold">Partner products</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  NyumbaSearch does not lend. These products are offered by named partners. Check
                  eligibility and disclosures before you apply.
                </p>
                <ul className="mt-3 space-y-3">
                  {partners.map((p) => (
                    <li key={p.id} className="rounded-xl border p-3 text-sm">
                      <p className="font-medium">
                        {p.name} — {p.product}
                      </p>
                      {p.eligibility ? (
                        <p className="mt-1 text-xs text-muted-foreground">Eligibility: {p.eligibility}</p>
                      ) : null}
                      {p.disclosure ? (
                        <p className="mt-1 text-xs text-muted-foreground">{p.disclosure}</p>
                      ) : null}
                      {p.applicationUrl ? (
                        <a
                          href={p.applicationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-primary"
                        >
                          Partner application →
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <Link to="/tenant" className="text-sm font-semibold text-primary">
              ← Back to search
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
