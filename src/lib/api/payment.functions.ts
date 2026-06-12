import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { fulfillPayment } from "@/lib/revenue/fulfill-payment";
import { isKenyanPhone } from "@/lib/phone";

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
  phoneNumber: z.string().refine(isKenyanPhone, "Invalid Safaricom phone number"),
  plan: z.string().optional(),
  boostPackage: z.enum(["spotlight", "homepage", "campaign"]).optional(),
  billingCycle: z.enum(["monthly", "quarterly"]).optional(),
  paymentMethod: z.enum(["mpesa", "card"]).optional(),
});

function formatPhone254(phone: string): string {
  let clean = phone.replaceAll("+", "").trim();
  if (clean.startsWith("0")) clean = "254" + clean.slice(1);
  else if (clean.startsWith("7") || clean.startsWith("1")) clean = "254" + clean;
  return clean;
}

async function runFulfillment(
  userId: string,
  propertyId: string | null,
  paymentType: string,
  amountKes: number,
  meta: {
    plan?: string;
    boostPackage?: string;
    billingCycle?: string;
    paymentMethod?: string;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await fulfillPayment(supabaseAdmin, {
    userId,
    propertyId,
    paymentType,
    amountKes,
    metadata: {
      plan: meta.plan,
      boostPackage: meta.boostPackage,
      billingCycle: meta.billingCycle,
      paymentMethod: meta.paymentMethod,
    },
  });
}

export const initiateMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(initiatePaymentSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone254 = formatPhone254(data.phoneNumber);

    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        property_id: data.propertyId ?? null,
        amount_kes: data.amountKes,
        status: "pending",
        payment_type: data.paymentType,
        mpesa_phone: phone254,
      })
      .select("*")
      .single();

    if (error) throw error;

    const { initiateStkPush, isMpesaConfigured } = await import("@/lib/api/mpesa");
    if (isMpesaConfigured() && data.paymentMethod !== "card") {
      const stk = await initiateStkPush({
        phone254,
        amountKes: data.amountKes,
        accountReference: row.id.slice(0, 12),
        transactionDesc: "NyumbaSearch",
      });

      await supabaseAdmin
        .from("payments")
        .update({ mpesa_checkout_id: stk.checkoutRequestId })
        .eq("id", row.id);

      return {
        success: true,
        paymentId: row.id,
        mode: "live" as const,
        message: stk.customerMessage,
      };
    }

    const receiptCode = "DEMO" + Math.random().toString(36).substring(2, 9).toUpperCase();
    await supabaseAdmin
      .from("payments")
      .update({ status: "completed", mpesa_receipt: receiptCode })
      .eq("id", row.id);

    await runFulfillment(userId, data.propertyId ?? null, data.paymentType, data.amountKes, {
      plan: data.plan,
      boostPackage: data.boostPackage,
      billingCycle: data.billingCycle,
      paymentMethod: data.paymentMethod,
    });

    if (data.paymentType === "premium_subscription") {
      await supabaseAdmin.from("profiles").update({ is_portal_active: true }).eq("id", userId);
    }

    return {
      success: true,
      paymentId: row.id,
      receiptCode,
      mode: "demo" as const,
      message: "Demo payment completed (configure MPESA_* env vars for live STK Push).",
    };
  });

export const verifyMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ paymentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);

    const { data: row, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return {
      status: row.status,
      receipt: row.mpesa_receipt,
    };
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
