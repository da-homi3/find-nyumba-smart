import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { useState } from "react";
import { formatKes } from "@/lib/properties";
import { submitInquiry } from "@/lib/submit-inquiry";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance & mortgages — NyumbaSearch" }] }),
  component: FinancePage,
});

function FinancePage() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<number | null>(null);

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
          {step < 4 ? (
            <div className="mt-4 space-y-4">
              {step === 0 && (
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  onChange={() => setStep(1)}
                >
                  <option>What are you looking for?</option>
                  <option>Buy a home</option>
                  <option>Build</option>
                  <option>Renovate</option>
                </select>
              )}
              {step === 1 && (
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  onChange={() => setStep(2)}
                >
                  <option>Monthly income range</option>
                  <option>Under KES 30k</option>
                  <option>KES 30k–60k</option>
                  <option>KES 60k–100k</option>
                  <option>Above KES 200k</option>
                </select>
              )}
              {step === 2 && (
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  onChange={() => setStep(3)}
                >
                  <option>KRA PIN + 6 months bank statements?</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              )}
              {step === 3 && (
                <input
                  type="number"
                  placeholder="Estimated property value (KES)"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  onBlur={(e) => {
                    setResult(Math.round(Number(e.target.value) * 0.7));
                    setStep(4);
                  }}
                />
              )}
            </div>
          ) : (
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
                      name: String(fd.get("name") ?? ""),
                      phone: String(fd.get("phone") ?? ""),
                      subject: "Mortgage / finance eligibility",
                      message: `Estimated loan: ${formatKes(result ?? 0)}`,
                      metadata: { estimatedLoanKes: String(result ?? 0) },
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
