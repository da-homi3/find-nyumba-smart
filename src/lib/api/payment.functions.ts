import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { isKenyanPhone } from "@/lib/phone";
import { initiatePaymentCore, initiatePaymentSchema } from "@/lib/payments/initiate-payment-core";

export { initiatePaymentSchema, checkoutMetaSchema } from "@/lib/payments/initiate-payment-core";

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(initiatePaymentSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    checkRateLimit(`payment:${userId}`, RATE_LIMITS.payment);
    return initiatePaymentCore(userId, data);
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

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const shouldSyncMpesa =
      row.status === "pending" && row.payment_method === "mpesa" && ageMs > 6_000;

    const synced = shouldSyncMpesa
      ? await (
          await import("@/lib/payments/complete-mpesa-payment")
        ).syncMpesaPaymentStatus(supabaseAdmin, row)
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
      requesterPhone: z.string().refine((p) => isKenyanPhone(p)),
      requesterEmail: z.string().email(),
    }),
  )
  .handler(async ({ data }) => {
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
    return (rows ?? []).map((row) => ({
      ...row,
      metadata: row.metadata as Record<string, string | number | boolean | null>,
    }));
  });
