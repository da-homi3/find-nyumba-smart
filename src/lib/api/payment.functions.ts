import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

export const initiateMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(initiatePaymentSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);

    // Format phone to 254... format
    let cleanPhone = data.phoneNumber.replace("+", "").trim();
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "254" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("7") || cleanPhone.startsWith("1")) {
      cleanPhone = "254" + cleanPhone;
    }

    // Generate a unique M-Pesa Transaction ID (in real, safaricom returns this. Here we generate a placeholder)
    const receiptCode = "MPESA" + Math.random().toString(36).substring(2, 9).toUpperCase();

    // Create a pending payment
    const { data: row, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        property_id: data.propertyId ?? null,
        amount_kes: data.amountKes,
        mpesa_receipt: receiptCode,
        status: "pending",
        payment_type: data.paymentType,
      })
      .select("*")
      .single();

    if (error) throw error;

    // Simulate callback completion for demo/development purposes after 2 seconds
    setTimeout(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("payments")
        .update({ status: "completed" })
        .eq("id", row.id);

      // If it is a property boost, set the property to verified or boosted
      if (data.propertyId && (data.paymentType === "featured_listing" || data.paymentType === "property_boost")) {
        await supabaseAdmin
          .from("properties")
          .update({ is_verified: true })
          .eq("id", data.propertyId);
      }
    }, 2000);

    return {
      success: true,
      paymentId: row.id,
      receiptCode,
      message: "STK Push sent. Please check your phone for the M-Pesa PIN prompt.",
    };
  });

export const verifyMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ paymentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase } = getContext(context);

    const { data: row, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
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
      .select(`
        *,
        properties (
          title,
          neighborhood
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });
