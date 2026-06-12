import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { VERIFICATION_TIERS } from "@/lib/revenue/plans";
import { useState } from "react";
import type { VerificationTier } from "@/lib/revenue/types";

export const Route = createFileRoute("/verify/request")({
  component: VerifyRequestPage,
});

function VerifyRequestPage() {
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<VerificationTier>("standard");
  const [address, setAddress] = useState("");
  const tierDef = VERIFICATION_TIERS.find((t) => t.id === tier)!;

  if (step === 4) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12">
          <CheckoutFlow
            lineItem={{
              title: tierDef.name,
              subtitle: `Turnaround: ${tierDef.turnaround}`,
              amountKes: tierDef.priceKes,
            }}
            metadata={{ paymentType: "verification", plan: tier }}
            allowQuarterly={false}
            onSuccess={() => setStep(5)}
          />
        </main>
      </PublicPageShell>
    );
  }

  if (step === 5) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">Verification request received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reference: NS-VERIFY-{Math.floor(Math.random() * 999999)}. We&apos;ll contact you within{" "}
            {tierDef.turnaround}.
          </p>
          <Link to="/verify" className="mt-6 inline-block text-primary text-sm font-semibold">
            Back to verification
          </Link>
        </main>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-lg px-5 py-12">
        <h1 className="font-display text-2xl font-semibold">
          Request verification — step {step} of 3
        </h1>
        {step === 1 && (
          <div className="mt-6 space-y-3">
            <input
              placeholder="Listing URL (optional)"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <textarea
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Property address"
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              placeholder="Landlord phone"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Next
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="mt-6 space-y-2">
            {VERIFICATION_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                className={`w-full rounded-xl border p-4 text-left ${tier === t.id ? "border-primary" : ""}`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.turnaround}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStep(3)}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Next
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="mt-6 space-y-3">
            <input
              required
              placeholder="Your name"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Email"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Phone"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setStep(4)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Proceed to payment
            </button>
          </div>
        )}
      </main>
    </PublicPageShell>
  );
}
