import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
import { isKenyanPhone, toMpesaPhone254 } from "@/lib/phone";
import { metadataFromCheckout, parsePaymentMetadata } from "@/lib/payments/payment-metadata";
import { assertStkPromptRateLimit } from "@/lib/payments/rate-limit";
import { getServerEnv } from "@/lib/server-env";

type AdminDb = SupabaseClient<Database>;

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
  advertisePackage: z.string().min(1).optional(),
  inquiryId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  successPath: z
    .string()
    .min(1)
    .refine((p) => p.startsWith("/") && !p.startsWith("//") && !/^https?:/i.test(p), {
      message: "successPath must be a relative app path",
    }),
  cancelPath: z
    .string()
    .min(1)
    .refine((p) => p.startsWith("/") && !p.startsWith("//") && !/^https?:/i.test(p), {
      message: "cancelPath must be a relative app path",
    })
    .optional(),
  title: z.string().trim().min(1).max(120),
});

export const initiatePaymentSchema = z.object({
  propertyId: z.string().uuid().optional(),
  amountKes: z
    .number()
    .int()
    .positive()
    .max(100_000, "M-Pesa STK push supports up to KES 100,000 — use card for higher amounts"),
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
    "rent_payment",
    "pm_module",
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
  const digits = toMpesaPhone254(phone);
  if (digits) return digits;
  // Fallback for already-normalized inputs that somehow skipped validation.
  let clean = phone.replaceAll(/[\s\-()+]/g, "");
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
    advertisePackage: data.advertisePackage,
    inquiryId: data.inquiryId,
    invoiceId: data.invoiceId,
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

function allowDemoMpesaCompletion(): boolean {
  if (getServerEnv("ALLOW_DEMO_PAYMENTS") === "true") return true;
  if (getServerEnv("ALLOW_DEMO_PAYMENTS") === "false") return false;
  return getServerEnv("MPESA_ENV") === "sandbox" && getServerEnv("NODE_ENV") === "development";
}

async function assertListerPurchaseRole(supabaseAdmin: AdminDb, userId: string) {
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

async function assertBoostOwnershipAndPrice(
  supabaseAdmin: AdminDb,
  userId: string,
  data: InitiatePaymentInput,
) {
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

  if (data.paymentType !== "property_boost" || !data.boostPackage) return;

  const { boostPrice } = await import("@/lib/revenue/plans");
  const { getLoyaltyLevel } = await import("@/lib/loyalty/points");
  const { applyLoyaltyDiscount } = await import("@/lib/loyalty/benefits");
  const level = await getLoyaltyLevel(supabaseAdmin, userId);
  const expected = applyLoyaltyDiscount(boostPrice(data.boostPackage), level);
  if (data.amountKes !== expected) {
    throw new Error(
      `Boost price mismatch — expected KES ${expected} for your ${level} loyalty tier`,
    );
  }
}

async function assertPaymentAuthorization(userId: string, data: InitiatePaymentInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (
    data.paymentType === "landlord_plan" ||
    data.paymentType === "premium_subscription" ||
    data.paymentType === "lead_pack"
  ) {
    await assertListerPurchaseRole(supabaseAdmin, userId);
  }

  if (data.paymentType === "property_boost" || data.paymentType === "featured_listing") {
    await assertBoostOwnershipAndPrice(supabaseAdmin, userId, data);
  }
}

async function completeMpesaPayment(
  supabaseAdmin: Awaited<ReturnType<typeof insertPayment>>["supabaseAdmin"],
  row: Awaited<ReturnType<typeof insertPayment>>["row"],
  data: InitiatePaymentInput,
) {
  // Idempotent retry: reuse existing STK instead of prompting again.
  if (row.mpesa_checkout_id) {
    return {
      paymentId: row.id,
      status: "pending" as const,
      method: "mpesa" as const,
      checkoutRequestId: row.mpesa_checkout_id,
      message: "Waiting for M-Pesa confirmation on your phone",
    };
  }

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

  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const receiptCode = `DEMO${Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 7)
    .toUpperCase()}`;
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
  if (data.paymentMethod === "mpesa") {
    await assertStkPromptRateLimit({ userId });
  }
  await assertPaymentAuthorization(userId, data);

  const { row, supabaseAdmin } = await insertPayment(userId, data, data.idempotencyKey);

  if (row.status === "completed") {
    return { paymentId: row.id, status: "completed" as const, method: data.paymentMethod };
  }

  if (data.paymentMethod === "mpesa") {
    return completeMpesaPayment(supabaseAdmin, row, data);
  }

  const meta = parsePaymentMetadata(row.metadata);
  if (row.mpesa_checkout_id && meta.orderTrackingId && meta.cardRedirectUrl) {
    return {
      paymentId: row.id,
      status: "pending" as const,
      method: "card" as const,
      redirectUrl: meta.cardRedirectUrl,
    };
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
  const card = await initiateCardPayment({
    reference,
    amountKes: data.amountKes,
    email: data.email ?? `user-${userId.slice(0, 8)}@nyumbasearch.ke`,
    phone: formatPhone254(data.phoneNumber || profile?.phone || "254700000000"),
    name: data.name ?? profile?.full_name ?? "NyumbaSearch customer",
    description: data.title,
  });

  await supabaseAdmin
    .from("payments")
    .update({
      mpesa_checkout_id: reference,
      metadata: {
        ...meta,
        paymentMethod: "card",
        orderTrackingId: card.orderTrackingId,
        cardRedirectUrl: card.authorizationUrl,
      },
    })
    .eq("id", row.id);

  return {
    paymentId: row.id,
    status: "pending" as const,
    method: "card" as const,
    redirectUrl: card.authorizationUrl,
  };
}
