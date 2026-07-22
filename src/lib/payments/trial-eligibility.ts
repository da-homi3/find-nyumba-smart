import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/** Subscription products that qualify for a free bonus month after the first paid period. */
export const TRIAL_ELIGIBLE_PAYMENT_TYPES = [
  "tenant_plus",
  "landlord_plan",
  "premium_subscription",
  "provider_subscription",
] as const;

export type TrialEligiblePaymentType = (typeof TRIAL_ELIGIBLE_PAYMENT_TYPES)[number];

export function isTrialEligiblePaymentType(paymentType: string): paymentType is TrialEligiblePaymentType {
  return (TRIAL_ELIGIBLE_PAYMENT_TYPES as readonly string[]).includes(paymentType);
}

export async function isFirstTimeSubscriber(
  supabaseAdmin: Admin,
  userId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return !data;
}

/**
 * Count completed subscription payments for this user.
 * Fulfillment runs after the current payment is marked completed, so the first
 * paid month has count === 1 and earns a +30 day bonus (second month free).
 */
export async function countCompletedSubscriptionPayments(
  supabaseAdmin: Admin,
  userId: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("payment_type", [...TRIAL_ELIGIBLE_PAYMENT_TYPES]);
  if (error) throw error;
  return count ?? 0;
}

/** Paid cycle length, plus one free month on the first successful subscription payment. */
export async function subscriptionPeriodDaysAfterPayment(
  supabaseAdmin: Admin,
  userId: string,
  billingCycle: "monthly" | "quarterly",
): Promise<{ days: number; bonusFreeMonth: boolean }> {
  const base = billingCycle === "quarterly" ? 90 : 30;
  const completed = await countCompletedSubscriptionPayments(supabaseAdmin, userId);
  const bonusFreeMonth = completed <= 1;
  return { days: bonusFreeMonth ? base + 30 : base, bonusFreeMonth };
}

export function addDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
