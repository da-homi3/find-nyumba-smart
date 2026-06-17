import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { createVerificationRequest } from "@/lib/api/payment.functions";
import { VERIFICATION_TIERS } from "@/lib/revenue/plans";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { VerificationTier } from "@/lib/revenue/types";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/verify/request")({
  component: VerifyRequestPage,
});

function VerifyRequestPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<VerificationTier>("standard");
  const [listingUrl, setListingUrl] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const tierDef = VERIFICATION_TIERS.find((t) => t.id === tier)!;

  useEffect(() => {
    if (user) {
      setEmail(user.email ?? "");
      setName((user.user_metadata?.full_name as string | undefined) ?? "");
      setPhone((user.user_metadata?.phone as string | undefined) ?? user.phone ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!loading && step >= 4 && !user) {
      navigate({
        to: "/auth",
        search: { redirect: "/verify/request" } as never,
        replace: true,
      });
    }
  }, [loading, user, step, navigate]);

  async function submitIntake() {
    if (!address.trim() || !name.trim() || !email.trim() || !phone.trim()) {
      toast.error("Fill in all required fields");
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/verify/request" } as never });
      return;
    }
    setSubmitting(true);
    try {
      const res = await createVerificationRequest({
        data: {
          propertyAddress: address,
          listingUrl: listingUrl || undefined,
          tier,
          requesterName: name,
          requesterPhone: phone,
          requesterEmail: email,
        },
      });
      setRequestId(res.id);
      setStep(4);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 4 && requestId && user) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-12">
          <h1 className="font-display text-2xl font-semibold">Complete payment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request ref: {requestId.slice(0, 8).toUpperCase()}
          </p>
          <div className="mt-8">
            <CheckoutFlow
              checkoutPath="/verify/request"
              lineItem={{
                title: tierDef.name,
                subtitle: `Turnaround: ${tierDef.turnaround}`,
                amountKes: tierDef.priceKes,
              }}
              metadata={{
                paymentType: "verification",
                verificationTier: tier,
                verificationRequestId: requestId,
                propertyAddress: address,
                listingUrl: listingUrl || undefined,
                requesterName: name,
                requesterPhone: phone,
                requesterEmail: email,
              }}
              defaultPhone={phone}
              allowQuarterly={false}
              onSuccess={() => {
                setStep(5);
                navigate({
                  to: "/verify/status/$requestId",
                  params: { requestId },
                });
              }}
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }

  if (step === 5 && requestId) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-lg px-5 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">Payment received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reference: {requestId.slice(0, 8).toUpperCase()}. Our agent is now verifying your
            property.
          </p>
          <Link
            to="/verify/status/$requestId"
            params={{ requestId }}
            className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Track verification status
          </Link>
          <Link to="/verify" className="mt-4 block text-sm font-semibold text-primary">
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
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
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
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!address.trim()}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
                <div className="font-semibold">
                  {t.name} — KES {t.priceKes.toLocaleString()}
                </div>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Phone (M-Pesa)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitIntake()}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Continue to payment"}
            </button>
          </div>
        )}
        <Link to="/verify" className="mt-6 block text-center text-sm text-primary">
          ← Back to verification info
        </Link>
      </main>
    </PublicPageShell>
  );
}
