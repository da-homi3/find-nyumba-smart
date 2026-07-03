import { z } from "zod";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
import { isKenyanPhone } from "@/lib/phone";
import { metadataFromCheckout } from "@/lib/payments/payment-metadata";
import { assertPaymentRateLimit } from "@/lib/payments/rate-limit";

export const checkoutMetaSchema = z.object({
  plan: z.string().optional(),
  boostPackage: z.enum(["spotlight", "homepage", "campaign"]).optional(),
  billingCycle: z.enum(["monthly", "quarterly"]).optional(),
  qty: z.number().int().positive().optional(),
  propertyAddress: z.string().optional(),
  listingUrl: z.string().optional(),
  requesterName: z.string().optional(),
  requesterPhone: z.string().optional(),
  requesterEmail: z.string().email().optional(),
  verificationTier: z.enum(["basic", "standard", "express"]).optional(),
  verificationRequestId: z.string().uuid().optional(),
  reportType: z.string().optional(),
  providerId: z.string().uuid().optional(),
  successPath: z.string().min(1),
  cancelPath: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(120),
});

export const initiatePaymentSchema = z.object({
  propertyId: z.string().uuid().optional(),
  amountKes: z
    .number()
    .int()
    .positive()
    .max(150_000, "M-Pesa STK push supports up to KES 150,000 per transaction"),
  paymentType: z.enum([
    "featured_listing",
    "premium_subscription",
    "property_boost",
    "tenant_plus",
    "lead_pack",
    "verification",
    "report",
    "invoice",
    "landlord_plan",
    "contact_unlock",
    "provider_subscription",
  ]),
  phoneNumber: z.string().refine((p) => !p || isKenyanPhone(p), "Invalid Safaricom phone number"),
  paymentMethod: z.enum(["mpesa", "card"]).default("mpesa"),
  idempotencyKey: z.string().min(8).max(64),
  email: z.string().email().optional(),
  name: z.string().optional(),
  ...checkoutMetaSchema.shape,
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

function formatPhone254(phone: string): string {
  let clean = phone.replaceAll("+", "").trim();
  if (clean.startsWith("0")) clean = "254" + clean.slice(1);
  else if (clean.startsWith("7") || clean.startsWith("1")) clean = "254" + clean;
  return clean;
}

async function insertPayment(userId: string, data: InitiatePaymentInput, idempotencyKey: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const metadata = metadataFromCheckout({
    plan: data.plan,
    boostPackage: data.boostPackage,
    billingCycle: data.billingCycle,
    paymentMethod: data.paymentMethod,
    qty: data.qty,
    propertyAddress: data.propertyAddress,
    listingUrl: data.listingUrl,
    requesterName: data.requesterName,
    requesterPhone: data.requesterPhone,
    requesterEmail: data.requesterEmail,
    verificationTier: data.verificationTier,
    verificationRequestId: data.verificationRequestId,
    reportType: data.reportType,
    providerId: data.providerId,
    successPath: data.successPath,
    cancelPath: data.cancelPath,
    title: data.title,
  });

  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return { row: existing, supabaseAdmin };

  const { data: row, error } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: userId,
      property_id: data.propertyId ?? null,
      amount_kes: data.amountKes,
      status: "pending",
      payment_type: data.paymentType,
      mpesa_phone: data.paymentMethod === "mpesa" ? formatPhone254(data.phoneNumber) : null,
      payment_method: data.paymentMethod,
      idempotency_key: idempotencyKey,
      metadata,
    } as never)
    .select("*")
    .single();

  if (error) throw error;
  return { row, supabaseAdmin };
}

const TRIAL_ELIGIBLE_PAYMENT_TYPES = [
  "tenant_plus",
  "landlord_plan",
  "premium_subscription",
  "provider_subscription",
] as const;

function defaultSubscriptionPlan(paymentType: string, plan?: string): string {
  if (plan) return plan;
  if (paymentType === "tenant_plus") return "plus";
  if (paymentType === "provider_subscription") return "basic";
  return "pro";
}

async function tryFirstSubscriptionTrial(
  userId: string,
  data: InitiatePaymentInput,
): Promise<{
  paymentId: null;
  status: "trial_started";
  trialEnd: string;
  subscriptionId: string;
  message: string;
} | null> {
  if (
    !TRIAL_ELIGIBLE_PAYMENT_TYPES.includes(
      data.paymentType as (typeof TRIAL_ELIGIBLE_PAYMENT_TYPES)[number],
    )
  ) {
    return null;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isFirstTimeSubscriber } = await import("@/lib/payments/trial-eligibility");
  const { startTrialingSubscription } = await import("@/lib/payments/start-trial-subscription");

  if (!(await isFirstTimeSubscriber(supabaseAdmin, userId))) {
    return null;
  }

  const plan = defaultSubscriptionPlan(data.paymentType, data.plan);
  const { trialEnd, subscriptionId } = await startTrialingSubscription(supabaseAdmin, {
    userId,
    paymentType: data.paymentType,
    plan,
    billingCycle: data.billingCycle ?? "monthly",
    paymentMethod: data.paymentMethod,
    amountKes: data.amountKes,
    providerId: data.providerId,
  });

  return {
    paymentId: null,
    status: "trial_started",
    trialEnd,
    subscriptionId,
    message: "Your first month is free — no payment collected today.",
  };
}

function allowDemoMpesaCompletion(): boolean {
  if (process.env.ALLOW_DEMO_PAYMENTS === "true") return true;
  if (process.env.ALLOW_DEMO_PAYMENTS === "false") return false;
  return process.env.MPESA_ENV === "sandbox" && process.env.NODE_ENV === "development";
}

async function assertPaymentAuthorization(userId: string, data: InitiatePaymentInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (
    data.paymentType === "landlord_plan" ||
    data.paymentType === "premium_subscription" ||
    data.paymentType === "lead_pack"
  ) {
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw error;
    const allowed = new Set(["landlord", "manager", "agency"]);
    if (!(roles ?? []).some((r) => allowed.has(r.role))) {
      throw new Error("A landlord, manager, or agency account is required for this purchase");
    }
  }

  if (data.paymentType === "property_boost" || data.paymentType === "featured_listing") {
    if (!data.propertyId) throw new Error("Select a property for this purchase");
    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select("owner_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (error) throw error;
    if (property?.owner_id !== userId) {
      throw new Error("You can only purchase boosts for your own listings");
    }
  }
}

async function completeMpesaPayment(
  supabaseAdmin: Awaited<ReturnType<typeof insertPayment>>["supabaseAdmin"],
  row: Awaited<ReturnType<typeof insertPayment>>["row"],
  data: InitiatePaymentInput,
) {
  if (!data.phoneNumber || !isKenyanPhone(data.phoneNumber)) {
    throw new Error("Enter a valid M-Pesa phone number");
  }
  const { initiateStkPush, isMpesaConfigured } = await import("@/lib/api/mpesa");
  if (isMpesaConfigured()) {
    const phone254 = formatPhone254(data.phoneNumber);
    const stk = await initiateStkPush({
      phone254,
      amountKes: data.amountKes,
      accountReference: row.id.slice(0, 12),
      transactionDesc: data.title.slice(0, 13),
    });

    await supabaseAdmin
      .from("payments")
      .update({ mpesa_checkout_id: stk.checkoutRequestId })
      .eq("id", row.id);

    return {
      paymentId: row.id,
      status: "pending" as const,
      method: "mpesa" as const,
      checkoutRequestId: stk.checkoutRequestId,
      message: stk.customerMessage,
    };
  }

  if (!allowDemoMpesaCompletion()) {
    throw new Error("M-Pesa payments are not configured. Contact support.");
  }

  const receiptCode = "DEMO" + Math.random().toString(36).substring(2, 9).toUpperCase();
  await supabaseAdmin
    .from("payments")
    .update({ status: "completed", mpesa_receipt: receiptCode })
    .eq("id", row.id);

  await fulfillPaymentRow(supabaseAdmin, {
    ...row,
    status: "completed",
    mpesa_receipt: receiptCode,
  });

  return {
    paymentId: row.id,
    status: "completed" as const,
    method: "mpesa" as const,
    receiptCode,
    message: "Demo payment completed (configure MPESA_* env vars for live STK Push).",
  };
}

/** Shared payment initiation — call from server handlers with a known userId. */
export async function initiatePaymentCore(userId: string, data: InitiatePaymentInput) {
  assertPaymentRateLimit(userId);
  await assertPaymentAuthorization(userId, data);

  const trialStarted = await tryFirstSubscriptionTrial(userId, data);
  if (trialStarted) return trialStarted;

  const { row, supabaseAdmin } = await insertPayment(userId, data, data.idempotencyKey);

  if (row.status === "completed") {
    return { paymentId: row.id, status: "completed" as const, method: data.paymentMethod };
  }

  if (data.paymentMethod === "mpesa") {
    return completeMpesaPayment(supabaseAdmin, row, data);
  }

  const { initiateCardPayment, isPesapalConfigured } = await import("@/lib/api/pesapal");
  if (!isPesapalConfigured()) {
    throw new Error("Card payments are not available yet. Use M-Pesa or try again later.");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", userId)
    .maybeSingle();

  const reference = `NS-${row.id}`;
  const { authorizationUrl } = await initiateCardPayment({
    reference,
    amountKes: data.amountKes,
    email: data.email ?? `user-${userId.slice(0, 8)}@nyumbasearch.ke`,
    phone: formatPhone254(data.phoneNumber || profile?.phone || "254700000000"),
    name: data.name ?? profile?.full_name ?? "NyumbaSearch customer",
    description: data.title,
  });

  await supabaseAdmin.from("payments").update({ mpesa_checkout_id: reference }).eq("id", row.id);

  return {
    paymentId: row.id,
    status: "pending" as const,
    method: "card" as const,
    redirectUrl: authorizationUrl,
  };
}
