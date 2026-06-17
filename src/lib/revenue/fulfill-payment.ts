import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { BoostPackage, LandlordPlan } from "@/lib/revenue/types";

import { BOOST_PACKAGES } from "@/lib/revenue/plans";

import { parsePaymentMetadata } from "@/lib/payments/payment-metadata";



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



function paymentMethod(metadata: PaymentFulfillment["metadata"]) {

  return metadata?.paymentMethod === "card" ? "card" : "mpesa";

}



function billingCycle(metadata: PaymentFulfillment["metadata"]) {

  return metadata?.billingCycle === "quarterly" ? "quarterly" : "monthly";

}



async function fulfillBoost(

  supabaseAdmin: SupabaseAdmin,

  payment: PaymentFulfillment,

) {

  const { userId, propertyId, amountKes, metadata = {} } = payment;

  if (!propertyId) return;

  const packageId = (metadata.boostPackage ?? "spotlight") as BoostPackage;

  const end = boostEndDate(packageId);

  await supabaseAdmin

    .from("properties")

    .update({

      featured_until: end.toISOString(),

      boost_package: packageId,

    })

    .eq("id", propertyId);



  await supabaseAdmin.from("listing_boosts").insert({

    listing_id: propertyId,

    user_id: userId,

    package: packageId,

    end_date: end.toISOString(),

    amount_paid_kes: amountKes,

    placements: boostPlacements(packageId),

  });

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

  const plan = (metadata.plan ?? "pro") as LandlordPlan;

  const cycle = billingCycle(metadata);

  await supabaseAdmin

    .from("profiles")

    .update({ landlord_plan: plan, is_portal_active: true })

    .eq("id", userId);



  await supabaseAdmin.from("subscriptions").insert({

    user_id: userId,

    plan,

    status: "active",

    amount_kes: amountKes,

    billing_cycle: cycle,

    payment_method: paymentMethod(metadata),

    next_billing_date: cycle === "quarterly" ? addBillingDays(90) : addBillingDays(30),

  });

}



async function fulfillTenantPlus(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {

  const { userId, amountKes, metadata = {} } = payment;

  const cycle = billingCycle(metadata);

  const days = cycle === "quarterly" ? 90 : 30;

  await supabaseAdmin

    .from("profiles")

    .update({

      tenant_plan: "plus",

      plus_expires_at: addBillingDays(days),

    })

    .eq("id", userId);



  await supabaseAdmin.from("subscriptions").insert({

    user_id: userId,

    plan: "plus",

    status: "active",

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



async function fulfillReport(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {

  const { userId, paymentId, metadata = {} } = payment;

  if (!paymentId) return;

  const reportType = String(metadata.reportType ?? metadata.plan ?? "quarterly-overview");

  await supabaseAdmin.from("report_purchases").insert({

    user_id: userId,

    report_type: reportType,

    payment_id: paymentId,

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

};



export async function fulfillPayment(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {

  const handler = FULFILLMENT_HANDLERS[payment.paymentType];

  if (handler) await handler(supabaseAdmin, payment);

}



export async function fulfillPaymentRow(

  supabaseAdmin: SupabaseAdmin,

  row: Database["public"]["Tables"]["payments"]["Row"],

) {

  const meta = parsePaymentMetadata(row.metadata);

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

    },

  });

}


