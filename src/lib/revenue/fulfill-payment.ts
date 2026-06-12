import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { BoostPackage, LandlordPlan } from "@/lib/revenue/types";
import { BOOST_PACKAGES } from "@/lib/revenue/plans";

type SupabaseAdmin = SupabaseClient<Database>;

export type PaymentFulfillment = {
  userId: string;
  propertyId: string | null;
  paymentType: string;
  amountKes: number;
  metadata?: Record<string, string | undefined> & {
    qty?: string;
    propertyAddress?: string;
    listingUrl?: string;
    requesterName?: string;
    requesterPhone?: string;
    requesterEmail?: string;
    verificationTier?: string;
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

export async function fulfillPayment(supabaseAdmin: SupabaseAdmin, payment: PaymentFulfillment) {
  const { userId, propertyId, paymentType, amountKes, metadata = {} } = payment;

  if (paymentType === "property_boost" || paymentType === "featured_listing") {
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
    return;
  }

  if (paymentType === "premium_subscription" || paymentType === "landlord_plan") {
    const plan = (metadata.plan ?? "pro") as LandlordPlan;
    await supabaseAdmin
      .from("profiles")
      .update({ landlord_plan: plan, is_portal_active: true })
      .eq("id", userId);

    await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      plan,
      status: "active",
      amount_kes: amountKes,
      billing_cycle: metadata.billingCycle === "quarterly" ? "quarterly" : "monthly",
      payment_method: metadata.paymentMethod === "card" ? "card" : "mpesa",
      next_billing_date:
        metadata.billingCycle === "quarterly" ? addBillingDays(90) : addBillingDays(30),
    });
    return;
  }

  if (paymentType === "tenant_plus") {
    const days = metadata.billingCycle === "quarterly" ? 90 : 30;
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
      billing_cycle: metadata.billingCycle === "quarterly" ? "quarterly" : "monthly",
      payment_method: metadata.paymentMethod === "card" ? "card" : "mpesa",
      next_billing_date: addBillingDays(days),
    });
    return;
  }

  if (paymentType === "verification" || paymentType === "report") {
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
    });
  }
}
