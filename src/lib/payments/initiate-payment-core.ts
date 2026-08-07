import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
import { isKenyanPhone, toMpesaPhone254 } from "@/lib/phone";
import { metadataFromCheckout, parsePaymentMetadata } from "@/lib/payments/payment-metadata";
import { assertStkPromptRateLimit } from "@/lib/payments/rate-limit";
import { getServerEnv } from "@/lib/server-env";

type AdminDb = SupabaseClient<Database>;

/**
 * How long one STK attempt stays live. Within this window a repeat request reuses the
 * existing prompt; callers building idempotency keys should bucket by the same window.
 */
export const STK_ATTEMPT_WINDOW_MS = 2 * 60 * 1000;

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

function isProductionHost(): boolean {
  const appUrl = (getServerEnv("PUBLIC_APP_URL") || getServerEnv("SITE_URL") || "").toLowerCase();
  return (
    appUrl.includes("nyumbasearch.com") ||
    (getServerEnv("MPESA_ENV") || "").toLowerCase() === "production"
  );
}

function allowDemoMpesaCompletion(): boolean {
  // Never auto-complete payments on production hosts, even if ALLOW_DEMO_PAYMENTS is mis-set.
  if (isProductionHost()) return false;
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

  if (!data.boostPackage) {
    throw new Error("Select a boost package");
  }

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

async function assertLandlordPlanPrice(
  supabaseAdmin: AdminDb,
  userId: string,
  data: InitiatePaymentInput,
) {
  if (data.paymentType !== "landlord_plan" && data.paymentType !== "premium_subscription") {
    return;
  }
  if (!data.plan) throw new Error("Select a subscription plan");

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("founding_member_status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const { isEarlyPartnerStatus } = await import("@/lib/promo/constants");
  const { planMonthlyPrice, resolveLandlordPlan } = await import("@/lib/revenue/plans");
  const planId = resolveLandlordPlan(data.plan);
  const earlyPartner = isEarlyPartnerStatus(profile?.founding_member_status);
  const monthly = planMonthlyPrice(planId, "monthly", { earlyPartner });
  // Match CheckoutFlow: quarterly is 10% off three discounted months.
  const expected = data.billingCycle === "quarterly" ? Math.round(monthly * 3 * 0.9) : monthly;
  if (data.amountKes !== expected) {
    throw new Error(
      earlyPartner
        ? `Early partner price mismatch — expected KES ${expected} (20% founding discount)`
        : `Plan price mismatch — expected KES ${expected}`,
    );
  }
}

async function assertRentPaymentAuthorization(
  supabaseAdmin: AdminDb,
  userId: string,
  data: InitiatePaymentInput,
) {
  if (!data.invoiceId) throw new Error("Rent payment requires an invoice");

  const { asPmDb } = await import("@/lib/pm/access");
  const { rentBalanceRemaining } = await import("@/lib/pm/invoice-status");
  const admin = asPmDb(supabaseAdmin);

  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("id, lease_id, amount_due, amount_paid, late_fee, status")
    .eq("id", data.invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Rent invoice not found");
  if (invoice.status === "paid") throw new Error("This invoice is already fully paid");

  const { data: lease } = await admin
    .from("pm_leases")
    .select("id, tenant_id")
    .eq("id", invoice.lease_id)
    .maybeSingle();
  if (!lease) throw new Error("Lease not found");

  const { data: tenant } = await admin
    .from("pm_tenants")
    .select("id, tenant_user_id, portal_status")
    .eq("id", lease.tenant_id)
    .eq("tenant_user_id", userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null)
    .maybeSingle();
  if (!tenant) throw new Error("Not authorised for this rent invoice");

  const balance = rentBalanceRemaining(
    Number(invoice.amount_due),
    Number(invoice.amount_paid),
    Number(invoice.late_fee ?? 0),
  );
  if (balance <= 0) throw new Error("Nothing left to pay on this invoice");
  // Allow partial rent STK (UI + payPmRent); reject overpay only.
  if (data.amountKes < 1 || data.amountKes > balance) {
    throw new Error(
      data.amountKes > balance
        ? `Amount cannot exceed the remaining balance (KES ${balance})`
        : "Enter a valid amount to pay",
    );
  }
}

/**
 * Contact unlock price is derived from the listing's rent, never from the client.
 * `unlockListingContact` prices this correctly, but the generic `initiatePayment`
 * endpoint accepts an arbitrary `amountKes`, so it has to be re-derived here.
 */
async function assertContactUnlockPrice(
  supabaseAdmin: AdminDb,
  data: InitiatePaymentInput,
): Promise<void> {
  if (!data.propertyId) throw new Error("Select a listing to unlock");

  const { data: property, error } = await supabaseAdmin
    .from("properties")
    .select("rent_kes")
    .eq("id", data.propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!property) throw new Error("Listing not found");

  const { unlockFeeForRent } = await import("@/lib/payments/unlock-pricing");
  const expected = unlockFeeForRent(Number(property.rent_kes ?? 0));
  if (data.amountKes !== expected) {
    throw new Error(`Unlock price mismatch — expected KES ${expected}`);
  }
}

async function assertTenantPlusPrice(data: InitiatePaymentInput): Promise<void> {
  const { PLUS_PLAN } = await import("@/lib/revenue/plans");
  const expected =
    data.billingCycle === "quarterly" ? PLUS_PLAN.quarterlyKes : PLUS_PLAN.monthlyKes;
  if (data.amountKes !== expected) {
    throw new Error(`Plus price mismatch — expected KES ${expected}`);
  }
}

async function assertLeadPackPrice(data: InitiatePaymentInput): Promise<void> {
  const { LEAD_PACKS } = await import("@/lib/revenue/plans");
  const pack = LEAD_PACKS.find((p) => p.qty === data.qty);
  if (!pack) throw new Error("Select a valid lead pack");
  if (data.amountKes !== pack.priceKes) {
    throw new Error(`Lead pack price mismatch — expected KES ${pack.priceKes}`);
  }
}

async function assertCatalogPrice(
  items: ReadonlyArray<{ id: string; priceKes: number }>,
  selectedId: string | undefined,
  amountKes: number,
  label: string,
): Promise<void> {
  const item = items.find((i) => i.id === selectedId);
  if (!item) throw new Error(`Select a valid ${label}`);
  if (amountKes !== item.priceKes) {
    throw new Error(`${label} price mismatch — expected KES ${item.priceKes}`);
  }
}

async function assertPmModulePaymentAuthorization(
  supabaseAdmin: AdminDb,
  userId: string,
  data: InitiatePaymentInput,
) {
  await assertListerPurchaseRole(supabaseAdmin, userId);
  const { asPmDb } = await import("@/lib/pm/access");
  const { recommendedPmTier } = await import("@/lib/pm/pricing");

  const recommended = await recommendedPmTier(asPmDb(supabaseAdmin), userId);
  if (data.amountKes !== recommended.priceKes) {
    throw new Error(`PM module price mismatch — expected KES ${recommended.priceKes}`);
  }
}

async function assertPaymentAuthorization(userId: string, data: InitiatePaymentInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (
    data.paymentType === "landlord_plan" ||
    data.paymentType === "premium_subscription" ||
    data.paymentType === "lead_pack" ||
    data.paymentType === "pm_module"
  ) {
    await assertListerPurchaseRole(supabaseAdmin, userId);
  }

  if (data.paymentType === "landlord_plan" || data.paymentType === "premium_subscription") {
    await assertLandlordPlanPrice(supabaseAdmin, userId, data);
  }

  if (data.paymentType === "property_boost" || data.paymentType === "featured_listing") {
    await assertBoostOwnershipAndPrice(supabaseAdmin, userId, data);
  }

  if (data.paymentType === "rent_payment") {
    await assertRentPaymentAuthorization(supabaseAdmin, userId, data);
  }

  if (data.paymentType === "pm_module") {
    await assertPmModulePaymentAuthorization(supabaseAdmin, userId, data);
  }

  // Every remaining product SKU also needs its price re-derived server-side. Without
  // this, a caller could pay KES 1 for a contact unlock or a Plus subscription and still
  // have fulfillment grant the full benefit.
  if (data.paymentType === "contact_unlock") {
    await assertContactUnlockPrice(supabaseAdmin, data);
  }

  if (data.paymentType === "tenant_plus") {
    await assertTenantPlusPrice(data);
  }

  if (data.paymentType === "lead_pack") {
    await assertLeadPackPrice(data);
  }

  if (data.paymentType === "verification") {
    const { VERIFICATION_TIERS } = await import("@/lib/revenue/plans");
    await assertCatalogPrice(
      VERIFICATION_TIERS,
      data.verificationTier,
      data.amountKes,
      "verification tier",
    );
  }

  if (data.paymentType === "report") {
    const { REPORT_CATALOG } = await import("@/lib/revenue/plans");
    await assertCatalogPrice(REPORT_CATALOG, data.reportType, data.amountKes, "report");
  }
}

async function reuseFreshCheckout(row: Awaited<ReturnType<typeof insertPayment>>["row"]) {
  if (!row.mpesa_checkout_id) return null;
  const ageMs = Date.now() - new Date(String(row.created_at ?? 0)).getTime();
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < STK_ATTEMPT_WINDOW_MS;
  if (!fresh || row.status !== "pending") return null;
  return {
    paymentId: row.id,
    status: "pending" as const,
    method: "mpesa" as const,
    checkoutRequestId: row.mpesa_checkout_id,
    message: "Waiting for M-Pesa confirmation on your phone",
  };
}

async function startRentIntasendStk(
  supabaseAdmin: Awaited<ReturnType<typeof insertPayment>>["supabaseAdmin"],
  row: Awaited<ReturnType<typeof insertPayment>>["row"],
  data: InitiatePaymentInput,
  phone254: string,
) {
  const { initiateIntasendStkPush, isIntasendCollectionConfigured } =
    await import("@/lib/pm/intasend-collect");
  if (!isIntasendCollectionConfigured()) return null;

  const stk = await initiateIntasendStkPush({
    phone254,
    amountKes: data.amountKes,
    apiRef: `rent-${row.id.replaceAll("-", "").slice(0, 16)}`,
    narrative: data.title.slice(0, 40),
  });

  const meta = parsePaymentMetadata(row.metadata);
  await supabaseAdmin
    .from("payments")
    .update({
      mpesa_checkout_id: stk.invoiceId,
      metadata: { ...meta, mpesaProvider: "intasend", paymentMethod: "mpesa" },
    })
    .eq("id", row.id);

  return {
    paymentId: row.id,
    status: "pending" as const,
    method: "mpesa" as const,
    checkoutRequestId: stk.invoiceId,
    message: stk.customerMessage,
  };
}

async function startDarajaStk(
  supabaseAdmin: Awaited<ReturnType<typeof insertPayment>>["supabaseAdmin"],
  row: Awaited<ReturnType<typeof insertPayment>>["row"],
  data: InitiatePaymentInput,
  phone254: string,
) {
  const { initiateStkPush, isMpesaConfigured } = await import("@/lib/api/mpesa");
  if (!isMpesaConfigured()) return null;

  const stk = await initiateStkPush({
    phone254,
    amountKes: data.amountKes,
    accountReference: row.id.slice(0, 12),
    transactionDesc: data.title.slice(0, 13),
  });

  const meta = parsePaymentMetadata(row.metadata);
  await supabaseAdmin
    .from("payments")
    .update({
      mpesa_checkout_id: stk.checkoutRequestId,
      metadata: { ...meta, mpesaProvider: "daraja", paymentMethod: "mpesa" },
    })
    .eq("id", row.id);

  return {
    paymentId: row.id,
    status: "pending" as const,
    method: "mpesa" as const,
    checkoutRequestId: stk.checkoutRequestId,
    message: stk.customerMessage,
  };
}

async function completeDemoMpesa(
  supabaseAdmin: Awaited<ReturnType<typeof insertPayment>>["supabaseAdmin"],
  row: Awaited<ReturnType<typeof insertPayment>>["row"],
  useIntasendForRent: boolean,
) {
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
    message: useIntasendForRent
      ? "Demo rent payment completed (configure INTASEND_SECRET_KEY for live IntaSend STK)."
      : "Demo payment completed (configure MPESA_* env vars for live Daraja STK).",
  };
}

async function completeMpesaPayment(
  supabaseAdmin: Awaited<ReturnType<typeof insertPayment>>["supabaseAdmin"],
  row: Awaited<ReturnType<typeof insertPayment>>["row"],
  data: InitiatePaymentInput,
) {
  if (row.status === "failed") {
    throw new Error("This payment attempt failed. Tap Prompt M-Pesa again to send a new request.");
  }

  // Idempotent retry within ~2 minutes: reuse existing STK instead of double-prompting.
  const reused = await reuseFreshCheckout(row);
  if (reused) return reused;
  if (row.mpesa_checkout_id) {
    await supabaseAdmin.from("payments").update({ mpesa_checkout_id: null }).eq("id", row.id);
  }

  if (!data.phoneNumber || !isKenyanPhone(data.phoneNumber)) {
    throw new Error("Enter a valid M-Pesa phone number");
  }

  const phone254 = formatPhone254(data.phoneNumber);
  const useIntasendForRent = data.paymentType === "rent_payment";

  if (useIntasendForRent) {
    // Rent stays on IntaSend only so collected funds land in the same wallet used for 99% owner payouts.
    const live = await startRentIntasendStk(supabaseAdmin, row, data, phone254);
    if (live) return live;
    if (!allowDemoMpesaCompletion()) {
      throw new Error(
        "Rent M-Pesa prompts require IntaSend (INTASEND_SECRET_KEY). Other payments still use Daraja.",
      );
    }
  } else {
    const live = await startDarajaStk(supabaseAdmin, row, data, phone254);
    if (live) return live;
    if (!allowDemoMpesaCompletion()) {
      throw new Error("M-Pesa payments are not configured. Contact support.");
    }
  }

  return completeDemoMpesa(supabaseAdmin, row, useIntasendForRent);
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
