import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { initiateStkPush, isMpesaConfigured } from "@/lib/api/mpesa";

const initiatePaymentSchema = z.object({
  propertyId: z.string().uuid().optional(),
  amountKes: z.number().int().positive(),
  paymentType: z.enum(["featured_listing", "premium_subscription", "property_boost"]),
  phoneNumber: z.string().regex(/^(?:\+254|0)?(7|1)\d{8}$/, "Invalid Safaricom phone number"),
});

function getContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

function formatPhone254(phone: string): string {
  let clean = phone.replace("+", "").trim();
  if (clean.startsWith("0")) clean = "254" + clean.slice(1);
  else if (clean.startsWith("7") || clean.startsWith("1")) clean = "254" + clean;
  return clean;
}

export const initiateMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(initiatePaymentSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getContext(context);
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

    if (isMpesaConfigured()) {
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

    // Demo mode when Daraja credentials are not configured
    const receiptCode = "DEMO" + Math.random().toString(36).substring(2, 9).toUpperCase();
    await supabaseAdmin
      .from("payments")
      .update({ status: "completed", mpesa_receipt: receiptCode })
      .eq("id", row.id);

    if (
      data.propertyId &&
      (data.paymentType === "featured_listing" || data.paymentType === "property_boost")
    ) {
      await supabaseAdmin
        .from("properties")
        .update({ is_verified: true })
        .eq("id", data.propertyId);
    }

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
    const { supabase, userId } = getContext(context);

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
    const { supabase, userId } = getContext(context);

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
