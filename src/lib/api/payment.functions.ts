import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
import { isKenyanPhone } from "@/lib/phone";
import { metadataFromCheckout } from "@/lib/payments/payment-metadata";
import { assertPaymentRateLimit } from "@/lib/payments/rate-limit";

const checkoutMetaSchema = z.object({
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
  successPath: z.string().min(1),
  cancelPath: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(120),
});

const initiatePaymentSchema = z.object({
  propertyId: z.string().uuid().optional(),
  amountKes: z.number().int().positive(),
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
  ]),
  phoneNumber: z
    .string()
    .refine((p) => !p || isKenyanPhone(p), "Invalid Safaricom phone number"),
  plan: z.string().optional(),
  boostPackage: z.enum(["spotlight", "homepage", "campaign"]).optional(),
  billingCycle: z.enum(["monthly", "quarterly"]).optional(),
  paymentMethod: z.enum(["mpesa", "card"]).default("mpesa"),
  idempotencyKey: z.string().min(8).max(64),
  email: z.string().email().optional(),
  name: z.string().optional(),
  ...checkoutMetaSchema.shape,
});

function formatPhone254(phone: string): string {
  let clean = phone.replaceAll("+", "").trim();
  if (clean.startsWith("0")) clean = "254" + clean.slice(1);
  else if (clean.startsWith("7") || clean.startsWith("1")) clean = "254" + clean;
  return clean;
}

async function insertPayment(
  userId: string,
  data: z.infer<typeof initiatePaymentSchema>,
  idempotencyKey: string,
) {
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

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(initiatePaymentSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    assertPaymentRateLimit(userId);
    const { row, supabaseAdmin } = await insertPayment(userId, data, data.idempotencyKey);

    if (row.status === "completed") {
      return { paymentId: row.id, status: "completed" as const, method: data.paymentMethod };
    }

    if (data.paymentMethod === "mpesa") {
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

    await supabaseAdmin
      .from("payments")
      .update({ mpesa_checkout_id: reference })
      .eq("id", row.id);

    return {
      paymentId: row.id,
      status: "pending" as const,
      method: "card" as const,
      redirectUrl: authorizationUrl,
    };
  });

/** @deprecated Use initiatePayment */
export const initiateMpesaPayment = initiatePayment;

export const verifyPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ paymentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    const synced =
      row.status === "pending" && row.payment_method === "mpesa"
        ? await (await import("@/lib/payments/complete-mpesa-payment")).syncMpesaPaymentStatus(
            supabaseAdmin,
            row,
          )
        : row;

    let message = "Waiting for M-Pesa confirmation";
    if (synced.status === "completed") message = "Payment confirmed";
    else if (synced.status === "failed") message = "Payment failed or was cancelled";

    return {
      status: synced.status,
      paymentId: synced.id,
      method: synced.payment_method,
      purpose: synced.payment_type,
      receipt: synced.mpesa_receipt ?? undefined,
      message,
    };
  });

/** @deprecated Use verifyPaymentStatus */
export const verifyMpesaPayment = verifyPaymentStatus;

export const createVerificationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyAddress: z.string().min(3),
      listingUrl: z.string().optional(),
      tier: z.enum(["basic", "standard", "express"]),
      requesterName: z.string().min(2),
      requesterPhone: z.string().refine(isKenyanPhone),
      requesterEmail: z.string().email(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tierPrices = { basic: 1000, standard: 2500, express: 5000 } as const;

    const { data: row, error } = await supabaseAdmin
      .from("verification_requests")
      .insert({
        property_address: data.propertyAddress,
        listing_url: data.listingUrl ?? null,
        requester_name: data.requesterName,
        requester_phone: data.requesterPhone,
        requester_email: data.requesterEmail,
        tier: data.tier,
        amount_paid_kes: tierPrices[data.tier],
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;
    return { id: row.id };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);

    const { data: rows, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        properties (
          title,
          neighborhood
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });
