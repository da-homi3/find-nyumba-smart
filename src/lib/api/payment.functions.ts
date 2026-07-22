import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { isKenyanPhone } from "@/lib/phone";
import { initiatePaymentCore, initiatePaymentSchema } from "@/lib/payments/initiate-payment-core";

export { initiatePaymentSchema, checkoutMetaSchema } from "@/lib/payments/initiate-payment-core";

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(initiatePaymentSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
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
    let synced = row;
    if (row.status === "pending" && ageMs > 6_000) {
      if (row.payment_method === "mpesa") {
        synced = await (
          await import("@/lib/payments/complete-mpesa-payment")
        ).syncMpesaPaymentStatus(supabaseAdmin, row);
      } else if (row.payment_method === "card") {
        synced = await (
          await import("@/lib/payments/complete-pesapal-payment")
        ).syncPesapalPaymentStatus(supabaseAdmin, row);
      }
    }

    let message = "Waiting for payment confirmation";
    if (synced.payment_method === "mpesa" && synced.status === "pending") {
      message = "Waiting for M-Pesa confirmation";
    } else if (synced.payment_method === "card" && synced.status === "pending") {
      message = "Waiting for card payment confirmation";
    }
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

async function findAuthUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/** Resolve or create a billing user for guest advertise checkout (no password login required). */
async function resolveAdvertiserUserId(opts: {
  email: string;
  name?: string;
  phone?: string;
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = opts.email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(email);
  if (existing) return existing.id;

  const password = `${crypto.randomUUID()}Aa1!`;
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: opts.name?.trim() || email.split("@")[0],
      phone: opts.phone?.trim() || undefined,
      source: "advertise_checkout",
    },
  });
  if (!error && created.user) return created.user.id;

  const retry = await findAuthUserByEmail(email);
  if (retry) return retry.id;
  throw new Error(error?.message ?? "Could not create billing account for this email");
}

const advertisePaymentSchema = initiatePaymentSchema.extend({
  paymentType: z.literal("invoice"),
  advertisePackage: z.string().min(1),
  email: z.string().email(),
  name: z.string().trim().min(1).max(120).optional(),
  inquiryId: z.string().uuid().optional(),
});

/** Public prefill for advertise pay page (limited fields only). */
export const getAdvertiseInquiryCheckout = createServerFn({ method: "GET" })
  .inputValidator(z.object({ inquiryId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inquiry, error } = await supabaseAdmin
      .from("partnership_inquiries")
      .select("id, email, contact_name, phone, company, metadata")
      .eq("id", data.inquiryId)
      .eq("inquiry_type", "advertise")
      .maybeSingle();
    if (error) throw error;
    if (!inquiry) return null;
    const meta = (inquiry.metadata ?? {}) as Record<string, string>;
    return {
      id: inquiry.id,
      email: inquiry.email,
      contactName: inquiry.contact_name,
      phone: inquiry.phone,
      company: inquiry.company,
      packageId: meta.package ?? null,
      status: meta.status ?? "pending",
    };
  });

/**
 * Public advertise checkout — M-Pesa STK or Pesapal card via the shared payment core.
 * Does not require an existing session; creates a billing user from the advertiser email.
 */
export const initiateAdvertisePayment = createServerFn({ method: "POST" })
  .inputValidator(advertisePaymentSchema)
  .handler(async ({ data }) => {
    const { ADVERTISE_PACKAGES, advertisePackagePrice } = await import("@/lib/revenue/plans");
    const pkg = ADVERTISE_PACKAGES.find((p) => p.id === data.advertisePackage);
    if (!pkg) throw new Error("Unknown advertising package");

    const expected = advertisePackagePrice(data.advertisePackage);
    if (data.amountKes !== expected) {
      throw new Error(`Amount must be KES ${expected.toLocaleString()} for ${pkg.name}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let email = data.email.trim().toLowerCase();
    let name = data.name?.trim();
    let phone: string | undefined = data.phoneNumber?.trim() || undefined;

    if (data.inquiryId) {
      const { data: inquiry, error } = await supabaseAdmin
        .from("partnership_inquiries")
        .select("id, email, contact_name, phone, inquiry_type, metadata")
        .eq("id", data.inquiryId)
        .eq("inquiry_type", "advertise")
        .maybeSingle();
      if (error) throw error;
      if (!inquiry) throw new Error("Advertising enquiry not found");
      if (inquiry.email?.includes("@")) email = inquiry.email.trim().toLowerCase();
      name = name || inquiry.contact_name;
      phone = phone || inquiry.phone?.trim() || undefined;
    }

    const userId = await resolveAdvertiserUserId({ email, name, phone });

    return initiatePaymentCore(userId, {
      ...data,
      paymentType: "invoice",
      email,
      name,
      phoneNumber: phone ?? data.phoneNumber ?? "",
      advertisePackage: data.advertisePackage,
      inquiryId: data.inquiryId,
      requesterEmail: email,
      requesterName: name,
      requesterPhone: phone,
      plan: data.advertisePackage,
    });
  });

/** Public status poll for advertise payments (scoped to invoice + payment id). */
export const verifyAdvertisePayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      paymentId: z.string().uuid(),
      inquiryId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parsePaymentMetadata } = await import("@/lib/payments/payment-metadata");

    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .eq("payment_type", "invoice")
      .maybeSingle();

    if (error) throw error;
    if (!row) throw new Error("Payment not found");

    const meta = parsePaymentMetadata(row.metadata);
    if (data.inquiryId && meta.inquiryId && meta.inquiryId !== data.inquiryId) {
      throw new Error("Payment does not match this enquiry");
    }

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    let synced = row;
    if (row.status === "pending" && ageMs > 6_000) {
      if (row.payment_method === "mpesa") {
        synced = await (
          await import("@/lib/payments/complete-mpesa-payment")
        ).syncMpesaPaymentStatus(supabaseAdmin, row);
      } else if (row.payment_method === "card") {
        synced = await (
          await import("@/lib/payments/complete-pesapal-payment")
        ).syncPesapalPaymentStatus(supabaseAdmin, row);
      }
    }

    let message = "Waiting for payment confirmation";
    if (synced.payment_method === "mpesa" && synced.status === "pending") {
      message = "Waiting for M-Pesa confirmation";
    } else if (synced.payment_method === "card" && synced.status === "pending") {
      message = "Waiting for card payment confirmation";
    }
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
