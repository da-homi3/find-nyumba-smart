import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { BoostPackage, LandlordPlan } from "@/lib/revenue/types";

import { BOOST_PACKAGES } from "@/lib/revenue/plans";

import { parsePaymentMetadata } from "@/lib/payments/payment-metadata";
import { notifyContactUnlockEmails } from "@/lib/email/contact-unlock-notify";

type SupabaseAdmin = SupabaseClient<Database>;

export type PaymentFulfillment = {
  userId: string;

  propertyId: string | null;

  paymentType: string;

  amountKes: number;

  paymentId?: string;

  metadata?: Record<string, string | number | undefined> & {
    qty?: number;

    propertyAddress?: string;

    listingUrl?: string;

    requesterName?: string;

    requesterPhone?: string;

    requesterEmail?: string;

    verificationTier?: string;

    verificationRequestId?: string;

    reportType?: string;

    billingCycle?: string;

    paymentMethod?: string;

    plan?: string;

    boostPackage?: string;

    providerId?: string;

    advertisePackage?: string;

    inquiryId?: string;

    renewalSubscriptionId?: string;
  };
};

function boostEndDate(packageId: BoostPackage): Date {
  const days = BOOST_PACKAGES.find((p) => p.id === packageId)?.durationDays ?? 7;

  const end = new Date();

  end.setDate(end.getDate() + days);

  return end;
}

function boostPlacements(packageId: BoostPackage): string[] {
  if (packageId === "spotlight") return ["search-top"];

  if (packageId === "homepage") return ["search-top", "homepage"];

  return ["search-top", "homepage", "newsletter", "push"];
}

function addBillingDays(days: number): string {
  const d = new Date();

  d.setDate(d.getDate() + days);

  return d.toISOString();
}

async function periodDaysForSubscriptionPayment(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  cycle: "monthly" | "quarterly",
): Promise<number> {
  const { subscriptionPeriodDaysAfterPayment } = await import("@/lib/payments/trial-eligibility");
  const { days } = await subscriptionPeriodDaysAfterPayment(supabaseAdmin, userId, cycle);
  return days;
}

function paymentMethod(metadata: PaymentFulfillment["metadata"]) {
  return metadata?.paymentMethod === "card" ? "card" : "mpesa";
}

function billingCycle(metadata: PaymentFulfillment["metadata"]) {
  return metadata?.billingCycle === "quarterly" ? "quarterly" : "monthly";
}

async function upsertActiveSubscription(
  supabaseAdmin: SupabaseAdmin,
  sub: {
    user_id: string;
    plan: string;
    amount_kes: number;
    billing_cycle: string;
    payment_method: string;
    next_billing_date: string;
    status?: string;
  },
) {
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", sub.user_id)
    .eq("plan", sub.plan)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: sub.status ?? "active",
        amount_kes: sub.amount_kes,
        billing_cycle: sub.billing_cycle,
        payment_method: sub.payment_method,
        next_billing_date: sub.next_billing_date,
        grace_period_end: null,
      })
      .eq("id", existing.id);
    return;
  }

  await supabaseAdmin.from("subscriptions").insert({
    user_id: sub.user_id,
    plan: sub.plan,
    status: sub.status ?? "active",
    amount_kes: sub.amount_kes,
    billing_cycle: sub.billing_cycle,
    payment_method: sub.payment_method,
    next_billing_date: sub.next_billing_date,
  });
}

async function fulfillRenewalSubscription(
  supabaseAdmin: SupabaseAdmin,
  payment: PaymentFulfillment,
  subscriptionId: string,
) {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return;

  const wasTrialing = sub.status === "trialing";
  const cycle = billingCycle(payment.metadata);
  const days = cycle === "quarterly" ? 90 : 30;

  await upsertActiveSubscription(supabaseAdmin, {
    user_id: sub.user_id,
    plan: sub.plan,
    amount_kes: payment.amountKes,
    billing_cycle: cycle,
    payment_method: paymentMethod(payment.metadata),
    next_billing_date: addBillingDays(days),
    status: "active",
  });

  if (sub.plan === "plus") {
    await supabaseAdmin
      .from("profiles")
      .update({ tenant_plan: "plus", plus_expires_at: addBillingDays(days) })
      .eq("id", sub.user_id);
  } else if (sub.plan === "basic" || sub.plan === "featured" || sub.plan === "premium") {
    // Tier only — go-live requires admin approval (status stays pending until then).
    await supabaseAdmin
      .from("service_providers")
      .update({ tier: sub.plan })
      .eq("user_id", sub.user_id);
  } else {
    const plan = (payment.metadata?.plan ?? sub.plan) as LandlordPlan;
    await supabaseAdmin
      .from("profiles")
      .update({ landlord_plan: plan, is_portal_active: true })
      .eq("id", sub.user_id);
  }

  if (wasTrialing) {
    const { onFirstSuccessfulRenewal } = await import("@/lib/promo/founding-member-lifecycle");
    await onFirstSuccessfulRenewal(supabaseAdmin, sub.user_id);
  }
}

async function fulfillBoost(
  supabaseAdmin: SupabaseAdmin,

  payment: PaymentFulfillment,
) {
  const { userId, propertyId, amountKes, metadata = {} } = payment;

  if (!propertyId) return;

  const { data: owned } = await supabaseAdmin
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (owned?.owner_id !== userId) return;

  const packageId = (metadata.boostPackage ?? "spotlight") as BoostPackage;

  const end = boostEndDate(packageId);

  await supabaseAdmin

    .from("properties")

    .update({
      featured_until: end.toISOString(),

      boost_package: packageId,
    })

    .eq("id", propertyId);

  const placements = boostPlacements(packageId);

  await supabaseAdmin.from("listing_boosts").insert({
    listing_id: propertyId,

    user_id: userId,

    package: packageId,

    end_date: end.toISOString(),

    amount_paid_kes: amountKes,

    placements,
  });

  // Campaign newsletter/push are ops-assisted — notify team to schedule them.
  if (
    packageId === "campaign" ||
    placements.includes("newsletter") ||
    placements.includes("push")
  ) {
    const { sendEmail } = await import("@/lib/email/send");
    const { formatKes } = await import("@/lib/properties");
    const opsTo = process.env.OPS_NOTIFICATION_EMAIL ?? "nyumbasearch101@gmail.com";
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("title, neighborhood")
      .eq("id", propertyId)
      .maybeSingle();
    const boostOpsText = [
      "A boost payment includes placements that need ops action:",
      "",
      `Listing: ${property?.title ?? propertyId} (${property?.neighborhood ?? "—"})`,
      `Package: ${packageId}`,
      `Placements: ${placements.join(", ")}`,
      `Amount: ${formatKes(amountKes)}`,
      `Active until: ${end.toISOString()}`,
      "",
      "Search-top and homepage are automatic via featured_until.",
      "Schedule newsletter mention and push notification before expiry.",
    ].join("\n");
    await sendEmail({
      to: opsTo,
      subject: `[NyumbaSearch] Boost placements to schedule — ${property?.title ?? propertyId}`,
      text: boostOpsText,
      html: boostOpsText.replaceAll("\n", "<br>"),
      templateId: "boost-placements-ops",
    });
  }
}

async function fulfillLeadPack(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { userId, metadata = {} } = payment;

  const qty = Number(metadata.qty ?? 0);

  if (qty <= 0) return;

  const { data: profile } = await supabaseAdmin

    .from("profiles")

    .select("lead_pack_balance")

    .eq("id", userId)

    .maybeSingle();

  const current = profile?.lead_pack_balance ?? 0;

  await supabaseAdmin

    .from("profiles")

    .update({ lead_pack_balance: current + qty })

    .eq("id", userId);
}

async function fulfillLandlordPlan(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { userId, amountKes, metadata = {} } = payment;

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const allowed = new Set(["landlord", "manager", "agency"]);
  if (!(roles ?? []).some((r) => allowed.has(r.role))) {
    throw new Error("Landlord plan fulfillment requires a landlord, manager, or agency role");
  }

  const plan = (metadata.plan ?? "pro") as LandlordPlan;

  const cycle = billingCycle(metadata);
  const days = await periodDaysForSubscriptionPayment(supabaseAdmin, userId, cycle);

  await supabaseAdmin

    .from("profiles")

    .update({ landlord_plan: plan, is_portal_active: true })

    .eq("id", userId);

  await upsertActiveSubscription(supabaseAdmin, {
    user_id: userId,
    plan,
    amount_kes: amountKes,
    billing_cycle: cycle,
    payment_method: paymentMethod(metadata),
    next_billing_date: addBillingDays(days),
  });
}

async function fulfillTenantPlus(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { userId, amountKes, metadata = {} } = payment;

  const cycle = billingCycle(metadata);
  const days = await periodDaysForSubscriptionPayment(supabaseAdmin, userId, cycle);

  await supabaseAdmin
    .from("profiles")
    .update({
      tenant_plan: "plus",
      plus_expires_at: addBillingDays(days),
    })
    .eq("id", userId);

  await upsertActiveSubscription(supabaseAdmin, {
    user_id: userId,
    plan: "plus",
    amount_kes: amountKes,
    billing_cycle: cycle,
    payment_method: paymentMethod(metadata),
    next_billing_date: addBillingDays(days),
  });
}

async function fulfillVerification(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { propertyId, amountKes, paymentId, metadata = {} } = payment;

  const requestId = metadata.verificationRequestId;

  if (requestId && paymentId) {
    await supabaseAdmin

      .from("verification_requests")

      .update({
        paid: true,

        payment_id: paymentId,

        amount_paid_kes: amountKes,

        status: "pending",
      })

      .eq("id", requestId);

    return;
  }

  await supabaseAdmin.from("verification_requests").insert({
    property_address: metadata.propertyAddress ?? "—",

    listing_url: metadata.listingUrl ?? null,

    listing_id: propertyId,

    requester_name: metadata.requesterName ?? "Customer",

    requester_phone: metadata.requesterPhone ?? "",

    requester_email: metadata.requesterEmail ?? "",

    tier: metadata.verificationTier ?? "standard",

    amount_paid_kes: amountKes,

    status: "pending",

    payment_id: paymentId ?? null,

    paid: Boolean(paymentId),
  });
}

async function fulfillContactUnlock(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { userId, propertyId, amountKes, paymentId } = payment;
  if (!propertyId) {
    throw new Error("Contact unlock payment is missing propertyId");
  }

  const { data: existing } = await supabaseAdmin
    .from("contact_unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", propertyId)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from("contact_unlocks").insert({
    user_id: userId,
    listing_id: propertyId,
    method: "paid",
    payment_id: paymentId ?? null,
    fee_charged: amountKes,
  });

  void notifyContactUnlockEmails(supabaseAdmin, {
    userId,
    listingId: propertyId,
    method: "paid",
    feeKes: amountKes,
    paidMethod: "M-Pesa",
  });
}

async function fulfillProviderSubscription(
  supabaseAdmin: SupabaseAdmin,
  payment: PaymentFulfillment,
) {
  const { userId, amountKes, metadata = {} } = payment;
  const tier =
    metadata.plan === "featured" || metadata.plan === "premium" ? metadata.plan : "basic";
  const cycle = billingCycle(metadata);

  // Save paid tier but keep status pending until an admin approves the listing.
  let providerUpdate = supabaseAdmin
    .from("service_providers")
    .update({ tier })
    .eq("user_id", userId);
  if (metadata.providerId) {
    providerUpdate = providerUpdate.eq("id", metadata.providerId);
  }
  await providerUpdate;

  const days = await periodDaysForSubscriptionPayment(supabaseAdmin, userId, cycle);

  await upsertActiveSubscription(supabaseAdmin, {
    user_id: userId,
    plan: tier,
    amount_kes: amountKes,
    billing_cycle: cycle,
    payment_method: paymentMethod(metadata),
    next_billing_date: addBillingDays(days),
  });
}

async function fulfillReport(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { userId, paymentId, metadata = {} } = payment;

  if (!paymentId) {
    throw new Error("Report purchase fulfillment requires paymentId");
  }

  const { data: existing } = await supabaseAdmin
    .from("report_purchases")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (existing) return;

  const reportType = String(metadata.reportType ?? metadata.plan ?? "quarterly-overview");

  await supabaseAdmin.from("report_purchases").insert({
    user_id: userId,
    report_type: reportType,
    payment_id: paymentId,
  });
}

async function fulfillInvoice(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const meta = payment.metadata ?? {};
  const inquiryId = typeof meta.inquiryId === "string" ? meta.inquiryId : undefined;
  const advertisePackage =
    (typeof meta.advertisePackage === "string" ? meta.advertisePackage : undefined) ??
    (typeof meta.plan === "string" ? meta.plan : undefined);

  if (inquiryId) {
    const { data: inquiry } = await supabaseAdmin
      .from("partnership_inquiries")
      .select("id, metadata, email, contact_name, company")
      .eq("id", inquiryId)
      .eq("inquiry_type", "advertise")
      .maybeSingle();

    if (inquiry) {
      const prev = (inquiry.metadata ?? {}) as Record<string, string>;
      await supabaseAdmin
        .from("partnership_inquiries")
        .update({
          metadata: {
            ...prev,
            package: advertisePackage ?? prev.package ?? "",
            packageAmount: String(payment.amountKes),
            status: "paid",
            paidAt: new Date().toISOString(),
            paymentId: payment.paymentId ?? "",
          },
        })
        .eq("id", inquiry.id);
    }
  }

  const { sendEmail } = await import("@/lib/email/send");
  const { ADVERTISE_PACKAGES } = await import("@/lib/revenue/plans");
  const { formatKes } = await import("@/lib/properties");
  const { getSiteUrl } = await import("@/lib/site");
  const pkg = ADVERTISE_PACKAGES.find((p) => p.id === advertisePackage);
  const packageLabel = pkg?.name ?? advertisePackage ?? "Advertising package";
  const opsTo = process.env.ADVERTISE_OPS_EMAIL ?? "nyumbasearch101@gmail.com";

  const opsText = [
    "Advertising payment received.",
    "",
    `Package: ${packageLabel}`,
    `Amount: ${formatKes(payment.amountKes)}`,
    `Payment ID: ${payment.paymentId ?? "—"}`,
    `Inquiry ID: ${inquiryId ?? "—"}`,
    `Payer user: ${payment.userId}`,
    "",
    "Activate the campaign placements within 48 hours.",
    `${getSiteUrl()}/admin`,
  ].join("\n");
  await sendEmail({
    to: opsTo,
    subject: `[NyumbaSearch] Ad package paid — ${packageLabel} — ${formatKes(payment.amountKes)}`,
    text: opsText,
    html: opsText.replaceAll("\n", "<br>"),
    templateId: "advertise-paid-ops",
  });
}

const FULFILLMENT_HANDLERS: Record<
  string,
  (admin: SupabaseAdmin, payment: PaymentFulfillment) => Promise<void>
> = {
  property_boost: fulfillBoost,

  featured_listing: fulfillBoost,

  lead_pack: fulfillLeadPack,

  premium_subscription: fulfillLandlordPlan,

  landlord_plan: fulfillLandlordPlan,

  tenant_plus: fulfillTenantPlus,

  verification: fulfillVerification,

  report: fulfillReport,

  contact_unlock: fulfillContactUnlock,

  provider_subscription: fulfillProviderSubscription,

  invoice: fulfillInvoice,
};

export async function fulfillPayment(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const renewalId = payment.metadata?.renewalSubscriptionId;
  if (renewalId) {
    await fulfillRenewalSubscription(supabaseAdmin, payment, renewalId);
    return;
  }

  const handler = FULFILLMENT_HANDLERS[payment.paymentType];

  if (handler) await handler(supabaseAdmin, payment);
}

export async function fulfillPaymentRow(
  supabaseAdmin: SupabaseAdmin,

  row: Database["public"]["Tables"]["payments"]["Row"],
) {
  const meta = parsePaymentMetadata(row.metadata);
  if (meta.fulfilledAt) return;

  try {
    await fulfillPayment(supabaseAdmin, {
      userId: row.user_id,

      propertyId: row.property_id,

      paymentType: row.payment_type,

      amountKes: row.amount_kes,

      paymentId: row.id,

      metadata: {
        plan: meta.plan,

        boostPackage: meta.boostPackage,

        billingCycle: meta.billingCycle,

        paymentMethod: meta.paymentMethod,

        qty: meta.qty,

        propertyAddress: meta.propertyAddress,

        listingUrl: meta.listingUrl,

        requesterName: meta.requesterName,

        requesterPhone: meta.requesterPhone,

        requesterEmail: meta.requesterEmail,

        verificationTier: meta.verificationTier,

        verificationRequestId: meta.verificationRequestId,

        reportType: meta.reportType,

        providerId: meta.providerId,

        advertisePackage: meta.advertisePackage,

        inquiryId: meta.inquiryId,

        renewalSubscriptionId: meta.renewalSubscriptionId,
      },
    });

    await supabaseAdmin
      .from("payments")
      .update({
        metadata: { ...meta, fulfilledAt: new Date().toISOString() },
      })
      .eq("id", row.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { Monitors } = await import("@/lib/alerts/monitors");
    void Monitors.paymentFulfillFailed(row.id, row.payment_type, message);
    throw err;
  }
}
