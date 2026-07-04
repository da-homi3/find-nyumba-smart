import { useState, useEffect, useRef } from "react";
import { CreditCard, Lock, Phone, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatKes } from "@/lib/properties";
import { initiatePayment, verifyPaymentStatus } from "@/lib/api/payment.functions";
import {
  pollPaymentUntilComplete,
  type PollPaymentStatus,
} from "@/lib/payments/poll-payment-client";
import { transactionReference } from "@/lib/revenue/plans";
import { isPesapalCheckoutEnabled } from "@/lib/pesapal-client";
import { errorMessage } from "@/lib/utils";
import type { InitiatePaymentInput } from "@/lib/payments/initiate-payment-core";

type PaymentPhase = "idle" | "sending" | "awaiting_pin" | "confirming";

function phaseLabelFor(phase: PaymentPhase, statusMessage: string | null): string | null {
  if (phase === "sending") return statusMessage;
  if (phase === "awaiting_pin") return statusMessage ?? "Enter your M-Pesa PIN on your phone";
  if (phase === "confirming") return statusMessage ?? "Confirming payment automatically…";
  return null;
}

type InitiatePaymentResult = Awaited<ReturnType<typeof initiatePayment>>;

function mpesaPendingMessage(res: InitiatePaymentResult): string {
  if (res.status === "trial_started") {
    return res.message ?? "Your free trial has started.";
  }
  if ("method" in res && res.method === "mpesa" && "message" in res) {
    return res.message ?? "Check your phone — enter your M-Pesa PIN.";
  }
  return "Check your phone — enter your M-Pesa PIN.";
}

function cardRedirectUrl(res: InitiatePaymentResult): string | null {
  if ("method" in res && res.method === "card" && "redirectUrl" in res && res.redirectUrl) {
    return res.redirectUrl;
  }
  return null;
}

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
    | "report"
    | "contact_unlock"
    | "provider_subscription"
    | "invoice";
  propertyId?: string;
  plan?: string;
  boostPackage?: "spotlight" | "homepage" | "campaign";
  billingCycle?: "monthly" | "quarterly";
  qty?: number;
  reportType?: string;
  verificationTier?: "basic" | "standard" | "express";
  verificationRequestId?: string;
  providerId?: string;
  propertyAddress?: string;
  listingUrl?: string;
  requesterName?: string;
  requesterPhone?: string;
  requesterEmail?: string;
  advertisePackage?: string;
  inquiryId?: string;
};

type Props = {
  lineItem: CheckoutLineItem;
  metadata: CheckoutMetadata;
  checkoutPath: string;
  defaultPhone?: string;
  defaultEmail?: string;
  /** Collect email on the form (guest advertise checkout). */
  requireEmail?: boolean;
  allowQuarterly?: boolean;
  onSuccess: (ref: string) => void;
  /** Override payment initiation (e.g. public advertise checkout). */
  initiateFn?: (data: InitiatePaymentInput) => Promise<InitiatePaymentResult>;
  /** Override status polling (e.g. public advertise verify). */
  verifyFn?: (paymentId: string) => Promise<PollPaymentStatus>;
};

export function CheckoutFlow({
  lineItem,
  metadata,
  checkoutPath,
  defaultPhone = "",
  defaultEmail = "",
  requireEmail = false,
  allowQuarterly = true,
  onSuccess,
  initiateFn,
  verifyFn,
}: Readonly<Props>) {
  const cardEnabled = isPesapalCheckoutEnabled();
  const [step, setStep] = useState(1);
  const [cycle, setCycle] = useState<"monthly" | "quarterly">("monthly");
  const [showCard, setShowCard] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [receipt, setReceipt] = useState<string | undefined>();
  const idempotencyRef = useRef(crypto.randomUUID());

  const waiting = phase !== "idle";
  const amountKes =
    cycle === "quarterly" && allowQuarterly
      ? Math.round(lineItem.amountKes * 3 * 0.9)
      : lineItem.amountKes;

  const billingCycle = cycle === "quarterly" ? "quarterly" : "monthly";

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const paymentId = params.get("paymentId");

    if (params.get("card") === "failed") {
      toast.error("Card payment was not completed");
      globalThis.history.replaceState({}, "", checkoutPath);
      return;
    }

    if (params.get("card") !== "success" || !paymentId) return;

    void (async () => {
      setPhase("confirming");
      setStatusMessage("Verifying card payment…");
      try {
        const status = verifyFn
          ? await verifyFn(paymentId)
          : await verifyPaymentStatus({ data: { paymentId } });
        if (status.status !== "completed") {
          toast.error(status.message ?? "Payment could not be verified");
          return;
        }
        setStep(3);
        const reference = transactionReference();
        setRef(reference);
        if (status.receipt) setReceipt(status.receipt);
        onSuccess(reference);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setPhase("idle");
        setStatusMessage(null);
        globalThis.history.replaceState({}, "", checkoutPath);
      }
    })();
  }, [checkoutPath, onSuccess, verifyFn]);

  async function completePayment(method: "mpesa" | "card") {
    if (method === "mpesa" && !phone.trim()) {
      toast.error("Enter your M-Pesa phone number");
      return;
    }
    const payerEmail = (email || defaultEmail || metadata.requesterEmail || "").trim();
    if (requireEmail && !payerEmail.includes("@")) {
      toast.error("Enter your email address for the receipt");
      return;
    }

    setPhase("sending");
    setStatusMessage(
      method === "mpesa" ? "Sending M-Pesa prompt to your phone…" : "Opening secure card checkout…",
    );

    try {
      const payload: InitiatePaymentInput = {
        amountKes,
        paymentType: metadata.paymentType,
        phoneNumber: phone || defaultPhone,
        propertyId: metadata.propertyId,
        plan: metadata.plan,
        boostPackage: metadata.boostPackage,
        billingCycle,
        paymentMethod: method,
        idempotencyKey: idempotencyRef.current,
        qty: metadata.qty,
        reportType: metadata.reportType,
        verificationTier: metadata.verificationTier,
        verificationRequestId: metadata.verificationRequestId,
        providerId: metadata.providerId,
        propertyAddress: metadata.propertyAddress,
        listingUrl: metadata.listingUrl,
        requesterName: metadata.requesterName,
        requesterPhone: metadata.requesterPhone ?? (phone || defaultPhone),
        requesterEmail: payerEmail || metadata.requesterEmail,
        advertisePackage: metadata.advertisePackage,
        inquiryId: metadata.inquiryId,
        email: payerEmail || undefined,
        name: metadata.requesterName,
        successPath: checkoutPath,
        cancelPath: checkoutPath,
        title: lineItem.title,
      };

      const res = initiateFn
        ? await initiateFn(payload)
        : await initiatePayment({ data: payload });

      if (res.status === "trial_started") {
        setRef("TRIAL");
        setStep(3);
        onSuccess("trial_started");
        return;
      }

      const redirect = cardRedirectUrl(res);
      if (redirect) {
        globalThis.location.href = redirect;
        return;
      }

      let mpesaReceipt: string | undefined;
      if (res.status === "pending" && res.paymentId) {
        setStatusMessage(mpesaPendingMessage(res));
        setPhase("awaiting_pin");
        mpesaReceipt = (
          await pollPaymentUntilComplete(res.paymentId, {
            onPhase: setPhase,
            onMessage: setStatusMessage,
            verify: verifyFn,
          })
        ).receipt;
      } else if (res.status === "completed" && "receiptCode" in res && res.receiptCode) {
        mpesaReceipt = res.receiptCode;
      }

      if (mpesaReceipt) setReceipt(mpesaReceipt);
      const reference = transactionReference();
      setRef(reference);
      setStep(3);
      onSuccess(reference);
    } catch (err) {
      toast.error(errorMessage(err));
      idempotencyRef.current = crypto.randomUUID();
    } finally {
      setPhase("idle");
      setStatusMessage(null);
    }
  }

  if (step === 3) {
    const isTrial = ref === "TRIAL";
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold">
          {isTrial ? "Free trial started" : "Payment confirmed"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{lineItem.title}</p>
        {!isTrial && <p className="mt-1 text-lg font-semibold">{formatKes(amountKes)}</p>}
        {isTrial && (
          <p className="mt-2 text-sm text-emerald-600">
            Your first month is free — no payment collected today.
          </p>
        )}
        {receipt && (
          <p className="mt-3 text-xs text-muted-foreground">
            M-Pesa receipt: <span className="font-mono font-medium text-foreground">{receipt}</span>
          </p>
        )}
        <p className="mt-4 rounded-xl bg-secondary px-4 py-2 font-mono text-xs">{ref}</p>
      </div>
    );
  }

  const phaseLabel = phaseLabelFor(phase, statusMessage);

  return (
    <div className="space-y-6">
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
              disabled={waiting}
              onClick={() => setCycle(c)}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold capitalize disabled:opacity-50 ${
                cycle === c ? "border-primary bg-primary/10 text-primary" : ""
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {requireEmail && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">Email for receipt</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={waiting}
            placeholder="you@company.com"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none disabled:opacity-60"
          />
        </label>
      )}

      <div className="rounded-2xl border-2 border-emerald-600/30 bg-emerald-50/50 p-5 dark:bg-emerald-950/20">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Phone className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Pay with M-Pesa</p>
            <p className="text-xs text-muted-foreground">
              We&apos;ll send an STK prompt to your phone
            </p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">M-Pesa number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={waiting}
            placeholder="0712345678"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none disabled:opacity-60"
          />
        </label>

        {waiting ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-emerald-600/30 bg-background/80 py-6 text-center text-sm">
            <Phone className="h-8 w-8 animate-pulse text-emerald-600" />
            <p className="max-w-xs font-medium">{phaseLabel}</p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void completePayment("mpesa")}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Send M-Pesa prompt · {formatKes(amountKes)}
          </button>
        )}
      </div>

      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Secured by M-Pesa Lipa na M-Pesa Online · payment confirms automatically
      </p>

      {cardEnabled && !waiting && (
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowCard((v) => !v)}
            className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <CreditCard className="h-4 w-4" />
            Pay with card instead
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showCard ? "rotate-180" : ""}`}
            />
          </button>

          {showCard && (
            <div className="mt-3 space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ll be redirected to our secure card checkout
              </p>
              <button
                type="button"
                onClick={() => void completePayment("card")}
                className="w-full rounded-xl border py-2.5 text-sm font-semibold"
              >
                Continue with card · {formatKes(amountKes)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Alias for payment integration spec */
export const UniversalCheckout = CheckoutFlow;
