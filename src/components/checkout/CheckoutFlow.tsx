import { useState } from "react";
import { CreditCard, Lock, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatKes } from "@/lib/properties";
import {
  createStripeCheckoutSession,
  initiateMpesaPayment,
  verifyMpesaPayment,
} from "@/lib/api/payment.functions";
import { transactionReference } from "@/lib/revenue/plans";
import { isStripeCheckoutEnabled } from "@/lib/stripe-client";
import { errorMessage } from "@/lib/utils";

export type CheckoutLineItem = {
  title: string;
  subtitle?: string;
  amountKes: number;
  features?: string[];
};

export type CheckoutMetadata = {
  paymentType:
    | "landlord_plan"
    | "premium_subscription"
    | "tenant_plus"
    | "property_boost"
    | "featured_listing"
    | "lead_pack"
    | "verification"
    | "report";
  propertyId?: string;
  plan?: string;
  boostPackage?: "spotlight" | "homepage" | "campaign";
  billingCycle?: "monthly" | "quarterly";
  qty?: number;
};

type Props = {
  lineItem: CheckoutLineItem;
  metadata: CheckoutMetadata;
  checkoutPath: string;
  defaultPhone?: string;
  allowQuarterly?: boolean;
  onSuccess: (ref: string) => void;
};

export function CheckoutFlow({
  lineItem,
  metadata,
  checkoutPath,
  defaultPhone = "",
  allowQuarterly = true,
  onSuccess,
}: Readonly<Props>) {
  const cardEnabled = isStripeCheckoutEnabled();
  const [step, setStep] = useState(1);
  const [cycle, setCycle] = useState<"monthly" | "quarterly">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card">("mpesa");
  const [phone, setPhone] = useState(defaultPhone);
  const [waiting, setWaiting] = useState(false);
  const [ref, setRef] = useState("");

  const amountKes =
    cycle === "quarterly" && allowQuarterly
      ? Math.round(lineItem.amountKes * 3 * 0.9)
      : lineItem.amountKes;

  const nextBilling = new Date();
  nextBilling.setDate(nextBilling.getDate() + (cycle === "quarterly" ? 90 : 30));

  async function completeMpesaPayment() {
    setWaiting(true);
    try {
      const res = await initiateMpesaPayment({
        data: {
          amountKes,
          paymentType: metadata.paymentType,
          phoneNumber: phone,
          propertyId: metadata.propertyId,
          plan: metadata.plan,
          boostPackage: metadata.boostPackage,
          billingCycle: cycle,
          paymentMethod: "mpesa",
        },
      });

      if (res.mode === "live" && res.paymentId) {
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await verifyMpesaPayment({ data: { paymentId: res.paymentId } });
          if (status.status === "completed") break;
          if (status.status === "failed") throw new Error("M-Pesa payment failed");
        }
      } else {
        await new Promise((r) => setTimeout(r, 2500));
      }
      const reference = transactionReference();
      setRef(reference);
      setStep(3);
      onSuccess(reference);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setWaiting(false);
    }
  }

  async function completeCardPayment() {
    setWaiting(true);
    try {
      const res = await createStripeCheckoutSession({
        data: {
          amountKes,
          paymentType: metadata.paymentType,
          propertyId: metadata.propertyId,
          plan: metadata.plan,
          boostPackage: metadata.boostPackage,
          billingCycle: cycle,
          successPath: checkoutPath,
          cancelPath: checkoutPath,
          title: lineItem.title,
        },
      });
      globalThis.location.href = res.url;
    } catch (err) {
      toast.error(errorMessage(err));
      setWaiting(false);
    }
  }

  function handlePay() {
    if (paymentMethod === "card") {
      void completeCardPayment();
      return;
    }
    void completeMpesaPayment();
  }

  if (step === 3) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold">Plan activated!</h2>
        <p className="mt-2 text-sm text-muted-foreground">{lineItem.title}</p>
        <p className="mt-1 text-lg font-semibold">{formatKes(amountKes)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Next billing: {nextBilling.toLocaleDateString("en-KE")}
        </p>
        <p className="mt-4 rounded-xl bg-secondary px-4 py-2 text-xs font-mono">{ref}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === 1 && (
        <>
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">{lineItem.title}</h2>
            {lineItem.subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{lineItem.subtitle}</p>
            )}
            <p className="mt-3 font-display text-2xl font-semibold text-primary">
              {formatKes(amountKes)}
              {allowQuarterly && cycle === "quarterly" && (
                <span className="ml-2 text-xs font-normal text-emerald-600">Save 10%</span>
              )}
            </p>
            {lineItem.features && (
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                {lineItem.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            )}
          </div>
          {allowQuarterly && (
            <div className="flex gap-2">
              {(["monthly", "quarterly"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold capitalize ${
                    cycle === c ? "border-primary bg-primary/10 text-primary" : ""
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Proceed to payment
          </button>
        </>
      )}

      {step === 2 && (
        <>
          {cardEnabled && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("mpesa")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${
                  paymentMethod === "mpesa" ? "border-primary bg-primary/10 text-primary" : ""
                }`}
              >
                <Phone className="h-4 w-4" /> M-Pesa
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${
                  paymentMethod === "card" ? "border-primary bg-primary/10 text-primary" : ""
                }`}
              >
                <CreditCard className="h-4 w-4" /> Card
              </button>
            </div>
          )}

          <div className="space-y-3">
            {paymentMethod === "mpesa" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">M-Pesa number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                />
              </label>
            )}
            {waiting ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-sm">
                {paymentMethod === "mpesa" ? (
                  <>
                    <Phone className="h-8 w-8 animate-pulse text-primary" />
                    <p>Waiting for M-Pesa confirmation…</p>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-8 w-8 animate-pulse text-primary" />
                    <p>Redirecting to secure card checkout…</p>
                  </>
                )}
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePay}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                {paymentMethod === "card"
                  ? `Pay with card · ${formatKes(amountKes)}`
                  : `Send payment request · ${formatKes(amountKes)}`}
              </button>
            )}
          </div>

          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {paymentMethod === "card"
              ? "Secured by Stripe"
              : "Secured by M-Pesa Lipa na M-Pesa Online"}
          </p>
          <button type="button" onClick={() => setStep(1)} className="text-sm text-primary">
            ← Back
          </button>
        </>
      )}
    </div>
  );
}
