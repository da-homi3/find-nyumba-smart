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

const stripeCheckoutSchema = z.object({
  amountKes: z.number().int().positive(),
  paymentType: initiatePaymentSchema.shape.paymentType,
  propertyId: z.string().uuid().optional(),
  plan: z.string().optional(),
  boostPackage: z.enum(["spotlight", "homepage", "campaign"]).optional(),
  billingCycle: z.enum(["monthly", "quarterly"]).optional(),
  successPath: z.string().min(1),
  cancelPath: z.string().min(1),
  title: z.string().trim().min(1).max(120),
});

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(stripeCheckoutSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { getStripe, isStripeConfigured } = await import("@/lib/api/stripe");
    if (!isStripeConfigured()) {
      throw new Error("Card payments are not available yet. Use M-Pesa or try again later.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSiteUrl } = await import("@/lib/site");

    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        property_id: data.propertyId ?? null,
        amount_kes: data.amountKes,
        status: "pending",
        payment_type: data.paymentType,
        mpesa_phone: null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const siteUrl = getSiteUrl();
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "kes",
      line_items: [
        {
          price_data: {
            currency: "kes",
            unit_amount: data.amountKes,
            product_data: { name: data.title },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}${data.successPath}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${data.cancelPath}?stripe=cancelled`,
      metadata: {
        payment_id: row.id,
        user_id: userId,
        payment_type: data.paymentType,
        plan: data.plan ?? "",
        boost_package: data.boostPackage ?? "",
        billing_cycle: data.billingCycle ?? "",
        property_id: data.propertyId ?? "",
      },
    });

    if (!session.url) throw new Error("Could not start card checkout");

    await supabaseAdmin.from("payments").update({ mpesa_checkout_id: session.id }).eq("id", row.id);

    return { url: session.url, paymentId: row.id };
  });

export const verifyStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ sessionId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { getStripe, isStripeConfigured } = await import("@/lib/api/stripe");
    if (!isStripeConfigured()) throw new Error("Stripe is not configured");

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    if (session.metadata?.user_id !== userId) {
      throw new Error("Invalid checkout session");
    }

    const paymentId = session.metadata?.payment_id;
    if (!paymentId) throw new Error("Missing payment reference");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("user_id", userId)
      .single();
    if (error || !row) throw new Error("Payment not found");

    if (row.status === "completed") {
      return { status: "completed" as const, paymentId: row.id };
    }

    if (session.payment_status !== "paid") {
      return { status: "pending" as const, paymentId: row.id };
    }

    const receipt =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? session.id);

    await supabaseAdmin
      .from("payments")
      .update({ status: "completed", mpesa_receipt: receipt })
      .eq("id", row.id);

    await runFulfillment(userId, row.property_id, row.payment_type, row.amount_kes, {
      plan: session.metadata?.plan || undefined,
      boostPackage: session.metadata?.boost_package || undefined,
      billingCycle: session.metadata?.billing_cycle || undefined,
      paymentMethod: "card",
    });

    if (row.payment_type === "premium_subscription") {
      await supabaseAdmin.from("profiles").update({ is_portal_active: true }).eq("id", userId);
    }

    return { status: "completed" as const, paymentId: row.id };
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
