import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { useState } from "react";
import { formatKes } from "@/lib/properties";
import { submitInquiry } from "@/lib/submit-inquiry";
import { formFieldValue } from "@/lib/utils";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance & mortgages — NyumbaSearch" }] }),
  component: FinancePage,
});

type FinanceGoal = "" | "buy" | "build" | "renovate";
type IncomeBand = "" | "under30" | "30-60" | "60-100" | "over200";
type DocsReady = "" | "yes" | "no";

function FinancePage() {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<FinanceGoal>("");
  const [income, setIncome] = useState<IncomeBand>("");
  const [docs, setDocs] = useState<DocsReady>("");
  const [propertyValue, setPropertyValue] = useState("");
  const [result, setResult] = useState<number | null>(null);

  function goNext() {
    if (step === 1 && goal) setStep(2);
    else if (step === 2 && income) setStep(3);
    else if (step === 3 && docs) setStep(4);
    else if (step === 4 && propertyValue.trim()) {
      const value = Number(propertyValue);
      if (Number.isFinite(value) && value > 0) {
        setResult(Math.round(value * 0.7));
        setStep(5);
      }
    }
  }

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-display text-4xl font-semibold">
          Ready to own? We&apos;ll connect you with the right lender.
        </h1>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Home mortgage",
              desc: "Rates from 12.5% p.a. with KCB, Equity, or Co-op Bank.",
            },
            {
              title: "Construction loan",
              desc: "Building on your plot? Get construction financing.",
            },
            { title: "Home improvement", desc: "Renovate or expand your current property." },
          ].map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-5">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Check my eligibility</h2>
          <p className="mt-1 text-xs text-muted-foreground">Step {Math.min(step, 4)} of 4</p>

          {step === 1 && (
            <div className="mt-4 space-y-4">
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={goal}
                onChange={(e) => setGoal(e.target.value as FinanceGoal)}
              >
                <option value="">What are you looking for?</option>
                <option value="buy">Buy a home</option>
                <option value="build">Build</option>
                <option value="renovate">Renovate</option>
              </select>
              <button
                type="button"
                disabled={!goal}
                onClick={goNext}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 space-y-4">
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={income}
                onChange={(e) => setIncome(e.target.value as IncomeBand)}
              >
                <option value="">Monthly income range</option>
                <option value="under30">Under KES 30k</option>
                <option value="30-60">KES 30k–60k</option>
                <option value="60-100">KES 60k–100k</option>
                <option value="over200">Above KES 200k</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border px-4 py-2 text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!income}
                  onClick={goNext}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-4 space-y-4">
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={docs}
                onChange={(e) => setDocs(e.target.value as DocsReady)}
              >
                <option value="">KRA PIN + 6 months bank statements?</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border px-4 py-2 text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!docs}
                  onClick={goNext}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-4 space-y-4">
              <input
                type="number"
                placeholder="Estimated property value (KES)"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={propertyValue}
                onChange={(e) => setPropertyValue(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl border px-4 py-2 text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!propertyValue.trim()}
                  onClick={goNext}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  See estimate →
                </button>
              </div>
            </div>
          )}

          {step >= 5 && (
            <div className="mt-4">
              <p className="text-sm">
                You may qualify for a loan of up to <strong>{formatKes(result ?? 3500000)}</strong>.
                KCB Bank and Equity Bank can help.
              </p>
              <form
                className="mt-4 grid gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await submitInquiry(
                    {
                      inquiryType: "finance",
                      name: formFieldValue(fd, "name"),
                      phone: formFieldValue(fd, "phone"),
                      subject: "Mortgage / finance eligibility",
                      message: `Estimated loan: ${formatKes(result ?? 0)}`,
                      metadata: {
                        estimatedLoanKes: String(result ?? 0),
                        goal,
                        income,
                        docs,
                      },
                    },
                    "Thank you. A loan officer will call you within 1 business day.",
                  );
                }}
              >
                <input
                  required
                  name="name"
                  placeholder="Name"
                  className="rounded-xl border px-3 py-2 text-sm"
                />
                <input
                  required
                  name="phone"
                  placeholder="Phone"
                  className="rounded-xl border px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Connect me with a loan officer
                </button>
              </form>
              <p className="mt-2 text-[10px] text-muted-foreground">
                NyumbaSearch earns a referral fee from the lender — you pay nothing extra.
              </p>
            </div>
          )}
        </section>
      </main>
    </PublicPageShell>
  );
}
